'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { EnhancedStore, StoreGroup } from '@/lib/multi-store/types';
import { Check, ChevronDown, Store, Settings, Plus } from 'lucide-react';

interface StoreSwitcherProps {
  currentStore: EnhancedStore;
  availableStores: EnhancedStore[];
  storeGroups: StoreGroup[];
  onStoreChange: (store: EnhancedStore) => void;
  onCreateGroup?: () => void;
  onManageStores?: () => void;
}

export function StoreSwitcher({
  currentStore,
  availableStores,
  storeGroups,
  onStoreChange,
  onCreateGroup,
  onManageStores
}: StoreSwitcherProps) {
  const [open, setOpen] = useState(false);

  // Group stores by store group
  const groupedStores = availableStores.reduce((acc, store) => {
    const groupId = store.store_group_id || 'ungrouped';
    if (!acc[groupId]) {
      acc[groupId] = [];
    }
    acc[groupId].push(store);
    return acc;
  }, {} as Record<string, EnhancedStore[]>);

  const getStoreGroupName = (groupId: string) => {
    if (groupId === 'ungrouped') return 'Individual Stores';
    return storeGroups.find(g => g.id === groupId)?.name || 'Unknown Group';
  };

  const getStoreStatusColor = (status: EnhancedStore['sync_status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'syncing':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          <div className="flex items-center space-x-2">
            <Store className="h-4 w-4" />
            <div className="flex flex-col items-start">
              <span className="truncate">{currentStore.shop_name}</span>
              <span className="text-xs text-muted-foreground truncate">
                {currentStore.shop_domain}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            {currentStore.is_master && (
              <Badge variant="secondary" className="text-xs">
                Master
              </Badge>
            )}
            <div
              className={`w-2 h-2 rounded-full ${getStoreStatusColor(currentStore.sync_status)}`}
              title={`Status: ${currentStore.sync_status}`}
            />
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px] p-0">
        <div className="p-2">
          <div className="text-sm font-medium text-muted-foreground px-2 py-1">
            Switch Store
          </div>
        </div>
        <DropdownMenuSeparator />
        
        <div className="max-h-[400px] overflow-y-auto">
          {Object.entries(groupedStores).map(([groupId, stores]) => (
            <div key={groupId} className="p-2">
              <div className="text-xs font-medium text-muted-foreground px-2 py-1 uppercase tracking-wide">
                {getStoreGroupName(groupId)}
              </div>
              {stores.map((store) => (
                <DropdownMenuItem
                  key={store.id}
                  className="cursor-pointer p-2"
                  onSelect={() => {
                    onStoreChange(store);
                    setOpen(false);
                  }}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center space-x-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{store.shop_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {store.shop_domain}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {store.is_master && (
                        <Badge variant="secondary" className="text-xs">
                          Master
                        </Badge>
                      )}
                      <div
                        className={`w-2 h-2 rounded-full ${getStoreStatusColor(store.sync_status)}`}
                        title={`Status: ${store.sync_status}`}
                      />
                      {currentStore.id === store.id && (
                        <Check className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </div>

        <DropdownMenuSeparator />
        <div className="p-2">
          {onCreateGroup && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                onCreateGroup();
                setOpen(false);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Store Group
            </DropdownMenuItem>
          )}
          {onManageStores && (
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                onManageStores();
                setOpen(false);
              }}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Stores
            </DropdownMenuItem>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Quick Store Selector for Forms
interface QuickStoreSelectorProps {
  stores: EnhancedStore[];
  selectedStoreIds: string[];
  onSelectionChange: (storeIds: string[]) => void;
  placeholder?: string;
  multiple?: boolean;
}

export function QuickStoreSelector({
  stores,
  selectedStoreIds,
  onSelectionChange,
  placeholder = "Select stores...",
  multiple = true
}: QuickStoreSelectorProps) {
  if (multiple) {
    return (
      <div className="space-y-2">
        {stores.map((store) => (
          <label key={store.id} className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedStoreIds.includes(store.id)}
              onChange={(e) => {
                if (e.target.checked) {
                  onSelectionChange([...selectedStoreIds, store.id]);
                } else {
                  onSelectionChange(selectedStoreIds.filter(id => id !== store.id));
                }
              }}
              className="rounded border-gray-300"
            />
            <div className="flex items-center space-x-2 flex-1">
              <Store className="h-4 w-4" />
              <div className="flex flex-col">
                <span className="text-sm font-medium">{store.shop_name}</span>
                <span className="text-xs text-muted-foreground">
                  {store.shop_domain}
                </span>
              </div>
              {store.is_master && (
                <Badge variant="secondary" className="text-xs">
                  Master
                </Badge>
              )}
              <div
                className={`w-2 h-2 rounded-full ${getStoreStatusColor(store.sync_status)}`}
                title={`Status: ${store.sync_status}`}
              />
            </div>
          </label>
        ))}
      </div>
    );
  }

  return (
    <Select
      value={selectedStoreIds[0] || ''}
      onValueChange={(value) => onSelectionChange([value])}
    >
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {stores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex items-center space-x-2">
              <Store className="h-4 w-4" />
              <span>{store.shop_name}</span>
              {store.is_master && (
                <Badge variant="secondary" className="text-xs">
                  Master
                </Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function getStoreStatusColor(status: EnhancedStore['sync_status']) {
  switch (status) {
    case 'active':
      return 'bg-green-500';
    case 'syncing':
      return 'bg-blue-500';
    case 'paused':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}