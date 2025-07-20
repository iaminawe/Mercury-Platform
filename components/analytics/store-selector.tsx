'use client';

import React, { useState, useEffect } from 'react';
import { Check, Store, ChevronDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface Store {
  id: string;
  shop_name: string;
  shop_domain: string;
  status: 'active' | 'inactive' | 'trial';
  last_sync: string;
  metrics?: {
    revenue: number;
    orders: number;
  };
}

interface StoreSelectorProps {
  stores: Store[];
  selectedStores: string[];
  onStoreSelect: (storeIds: string[]) => void;
  multiple?: boolean;
  showMetrics?: boolean;
  className?: string;
}

export function StoreSelector({
  stores,
  selectedStores,
  onStoreSelect,
  multiple = true,
  showMetrics = false,
  className
}: StoreSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredStores = stores.filter(store =>
    store.shop_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    store.shop_domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleStore = (storeId: string) => {
    if (multiple) {
      if (selectedStores.includes(storeId)) {
        onStoreSelect(selectedStores.filter(id => id !== storeId));
      } else {
        onStoreSelect([...selectedStores, storeId]);
      }
    } else {
      onStoreSelect([storeId]);
      setOpen(false);
    }
  };

  const selectAll = () => {
    if (selectedStores.length === stores.length) {
      onStoreSelect([]);
    } else {
      onStoreSelect(stores.map(s => s.id));
    }
  };

  const clearSelection = () => {
    onStoreSelect([]);
  };

  const getStatusColor = (status: Store['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-600 border-green-500/20';
      case 'trial':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'inactive':
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
    }
  };

  const formatRevenue = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
        >
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4" />
            <span className="text-left truncate">
              {selectedStores.length === 0
                ? "Select stores..."
                : selectedStores.length === 1
                ? stores.find(s => s.id === selectedStores[0])?.shop_name
                : `${selectedStores.length} stores selected`}
            </span>
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-1"
                onClick={() => setSearchQuery('')}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {multiple && (
            <div className="flex items-center justify-between p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={selectAll}
                className="text-xs"
              >
                {selectedStores.length === stores.length ? 'Deselect All' : 'Select All'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-xs"
                disabled={selectedStores.length === 0}
              >
                Clear
              </Button>
            </div>
          )}
          <CommandList>
            <CommandEmpty>No stores found.</CommandEmpty>
            <CommandGroup>
              {filteredStores.map((store) => (
                <CommandItem
                  key={store.id}
                  value={store.id}
                  onSelect={() => toggleStore(store.id)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start gap-3 w-full">
                    {multiple ? (
                      <Checkbox
                        checked={selectedStores.includes(store.id)}
                        className="mt-1"
                      />
                    ) : (
                      <Check
                        className={cn(
                          "h-4 w-4 mt-1",
                          selectedStores.includes(store.id) ? "opacity-100" : "opacity-0"
                        )}
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{store.shop_name}</span>
                          <Badge 
                            variant="outline" 
                            className={cn("text-xs", getStatusColor(store.status))}
                          >
                            {store.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {store.shop_domain}
                      </div>
                      {showMetrics && store.metrics && (
                        <div className="flex items-center gap-4 mt-2 text-xs">
                          <div>
                            <span className="text-muted-foreground">Revenue: </span>
                            <span className="font-medium">
                              {formatRevenue(store.metrics.revenue)}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Orders: </span>
                            <span className="font-medium">
                              {store.metrics.orders.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}