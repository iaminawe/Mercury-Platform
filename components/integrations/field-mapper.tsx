'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowRight, 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle,
  RefreshCw,
  Code,
  Eye,
  EyeOff
} from 'lucide-react';
import { toast } from 'sonner';

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string;
  isRequired: boolean;
  isActive: boolean;
}

interface Field {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';
  description?: string;
  required?: boolean;
  example?: any;
}

interface FieldMapperProps {
  sourceName: string;
  targetName: string;
  sourceFields: Field[];
  targetFields: Field[];
  mappings?: FieldMapping[];
  onSave: (mappings: FieldMapping[]) => void;
  transformations?: {
    name: string;
    description: string;
    code: string;
  }[];
}

export function FieldMapper({
  sourceName,
  targetName,
  sourceFields,
  targetFields,
  mappings: initialMappings = [],
  onSave,
  transformations = []
}: FieldMapperProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>(initialMappings);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState('mappings');
  const [autoMapEnabled, setAutoMapEnabled] = useState(true);

  // Auto-map fields on mount if enabled
  useEffect(() => {
    if (autoMapEnabled && mappings.length === 0) {
      autoMapFields();
    }
  }, []);

  const autoMapFields = () => {
    const autoMappings: FieldMapping[] = [];
    
    // Try to match fields by name (case-insensitive)
    sourceFields.forEach(sourceField => {
      const targetField = targetFields.find(tf => 
        tf.name.toLowerCase() === sourceField.name.toLowerCase() ||
        tf.name.toLowerCase().replace(/_/g, '') === sourceField.name.toLowerCase().replace(/_/g, '')
      );
      
      if (targetField) {
        autoMappings.push({
          id: crypto.randomUUID(),
          sourceField: sourceField.name,
          targetField: targetField.name,
          isRequired: targetField.required || false,
          isActive: true
        });
      }
    });
    
    setMappings(autoMappings);
    toast.success(`Auto-mapped ${autoMappings.length} fields`);
  };

  const addMapping = () => {
    const newMapping: FieldMapping = {
      id: crypto.randomUUID(),
      sourceField: '',
      targetField: '',
      isRequired: false,
      isActive: true
    };
    setMappings([...mappings, newMapping]);
  };

  const updateMapping = (id: string, updates: Partial<FieldMapping>) => {
    setMappings(mappings.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  };

  const removeMapping = (id: string) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const clearAllMappings = () => {
    setMappings([]);
    toast.success('All mappings cleared');
  };

  const handleSave = () => {
    // Validate mappings
    const invalidMappings = mappings.filter(m => 
      m.isActive && (!m.sourceField || !m.targetField)
    );
    
    if (invalidMappings.length > 0) {
      toast.error('Please complete all active mappings');
      return;
    }
    
    onSave(mappings);
    toast.success('Field mappings saved successfully');
  };

  const getFieldType = (fields: Field[], fieldName: string) => {
    const field = fields.find(f => f.name === fieldName);
    return field?.type || 'unknown';
  };

  const getFieldBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      string: 'bg-blue-100 text-blue-800',
      number: 'bg-green-100 text-green-800',
      boolean: 'bg-purple-100 text-purple-800',
      date: 'bg-orange-100 text-orange-800',
      array: 'bg-pink-100 text-pink-800',
      object: 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const generatePreviewData = () => {
    const preview: any = {};
    
    mappings.filter(m => m.isActive).forEach(mapping => {
      const sourceField = sourceFields.find(f => f.name === mapping.sourceField);
      if (sourceField?.example) {
        let value = sourceField.example;
        
        // Apply transformation if selected
        if (mapping.transformation) {
          const transform = transformations.find(t => t.name === mapping.transformation);
          if (transform) {
            // This would normally execute the transformation
            value = `[Transformed: ${value}]`;
          }
        }
        
        preview[mapping.targetField] = value;
      }
    });
    
    return preview;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Field Mapping</CardTitle>
            <CardDescription>
              Map fields from {sourceName} to {targetName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={autoMapEnabled}
              onCheckedChange={setAutoMapEnabled}
            />
            <Label className="text-sm">Auto-map fields</Label>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="mappings">Mappings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="mappings" className="space-y-4">
            {/* Actions */}
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <Button onClick={addMapping} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add Mapping
                </Button>
                <Button onClick={autoMapFields} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Auto-map
                </Button>
              </div>
              {mappings.length > 0 && (
                <Button onClick={clearAllMappings} variant="ghost" size="sm">
                  Clear All
                </Button>
              )}
            </div>
            
            {/* Mapping List */}
            <div className="space-y-3">
              {mappings.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No field mappings configured. Click "Add Mapping" or "Auto-map" to get started.
                  </AlertDescription>
                </Alert>
              ) : (
                mappings.map((mapping) => (
                  <div
                    key={mapping.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg ${
                      !mapping.isActive ? 'opacity-50' : ''
                    }`}
                  >
                    <Switch
                      checked={mapping.isActive}
                      onCheckedChange={(checked) =>
                        updateMapping(mapping.id, { isActive: checked })
                      }
                    />
                    
                    <div className="flex-1 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
                      {/* Source Field */}
                      <div className="md:col-span-2">
                        <Select
                          value={mapping.sourceField}
                          onValueChange={(value) =>
                            updateMapping(mapping.id, { sourceField: value })
                          }
                          disabled={!mapping.isActive}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select source field" />
                          </SelectTrigger>
                          <SelectContent>
                            {sourceFields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center gap-2">
                                  <span>{field.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getFieldBadgeColor(field.type)}`}
                                  >
                                    {field.type}
                                  </Badge>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {/* Arrow */}
                      <div className="flex justify-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      
                      {/* Target Field */}
                      <div className="md:col-span-2">
                        <Select
                          value={mapping.targetField}
                          onValueChange={(value) =>
                            updateMapping(mapping.id, { targetField: value })
                          }
                          disabled={!mapping.isActive}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select target field" />
                          </SelectTrigger>
                          <SelectContent>
                            {targetFields.map((field) => (
                              <SelectItem key={field.name} value={field.name}>
                                <div className="flex items-center gap-2">
                                  <span>{field.name}</span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${getFieldBadgeColor(field.type)}`}
                                  >
                                    {field.type}
                                  </Badge>
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Transformation */}
                    {transformations.length > 0 && (
                      <Select
                        value={mapping.transformation}
                        onValueChange={(value) =>
                          updateMapping(mapping.id, { transformation: value })
                        }
                        disabled={!mapping.isActive}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Transform" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {transformations.map((t) => (
                            <SelectItem key={t.name} value={t.name}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    
                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMapping(mapping.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
            
            {/* Save Button */}
            <div className="flex justify-end">
              <Button onClick={handleSave}>
                Save Mappings
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Preview how your data will be mapped
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show Preview
                  </>
                )}
              </Button>
            </div>
            
            {showPreview && (
              <div className="bg-muted p-4 rounded-lg">
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(generatePreviewData(), null, 2)}
                </pre>
              </div>
            )}
            
            {/* Mapping Summary */}
            <div className="space-y-2">
              <h4 className="font-medium">Active Mappings</h4>
              {mappings.filter(m => m.isActive).map((mapping) => (
                <div key={mapping.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline">{mapping.sourceField}</Badge>
                  <ArrowRight className="h-3 w-3" />
                  <Badge variant="outline">{mapping.targetField}</Badge>
                  {mapping.transformation && (
                    <>
                      <Code className="h-3 w-3" />
                      <Badge variant="secondary">{mapping.transformation}</Badge>
                    </>
                  )}
                  {mapping.isRequired && (
                    <Badge variant="destructive" className="text-xs">Required</Badge>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="advanced" className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Advanced mapping options for complex data transformations
              </AlertDescription>
            </Alert>
            
            {/* Custom Transformation Editor */}
            <div className="space-y-2">
              <Label>Custom Transformation (JavaScript)</Label>
              <Textarea
                placeholder="// Example: return value.toUpperCase();"
                className="font-mono text-sm"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Write custom JavaScript to transform field values
              </p>
            </div>
            
            {/* Validation Rules */}
            <div className="space-y-2">
              <Label>Validation Rules</Label>
              <Textarea
                placeholder="Define validation rules in JSON format"
                className="font-mono text-sm"
                rows={4}
              />
            </div>
            
            {/* Default Values */}
            <div className="space-y-2">
              <Label>Default Values</Label>
              <p className="text-sm text-muted-foreground">
                Set default values for unmapped required fields
              </p>
              {targetFields
                .filter(f => f.required && !mappings.some(m => m.targetField === f.name))
                .map((field) => (
                  <div key={field.name} className="flex items-center gap-2">
                    <Label className="w-32 text-sm">{field.name}</Label>
                    <Input
                      placeholder={`Default value for ${field.name}`}
                      className="flex-1"
                    />
                  </div>
                ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}