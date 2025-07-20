"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Eye, 
  EyeOff, 
  Code, 
  Type, 
  Palette, 
  MousePointer,
  Undo,
  Redo,
  Save,
  Play,
  Pause,
  Copy,
  Trash2,
  Plus,
  Minus,
  Settings,
  Target,
  Zap,
  BarChart,
  Users,
  DollarSign
} from 'lucide-react';
import { VariantModification, Variant } from '@/lib/ab-testing/types';

interface VisualEditorProps {
  experimentId?: string;
  variant: Variant;
  onSave: (modifications: VariantModification[]) => Promise<void>;
  previewUrl?: string;
}

export function VisualEditor({ experimentId, variant, onSave, previewUrl }: VisualEditorProps) {
  const [modifications, setModifications] = useState<VariantModification[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [history, setHistory] = useState<VariantModification[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize iframe communication
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'elementSelected') {
        setSelectedElement(event.data.selector);
      } else if (event.data.type === 'elementHovered') {
        highlightElement(event.data.selector);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Load preview page in iframe
  useEffect(() => {
    if (iframeRef.current && previewUrl) {
      iframeRef.current.src = previewUrl;
    }
  }, [previewUrl]);

  // Apply modifications to preview
  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.contentWindow?.postMessage({
        type: 'applyModifications',
        modifications
      }, '*');
    }
  }, [modifications]);

  const addModification = (modification: VariantModification) => {
    const newModifications = [...modifications, modification];
    setModifications(newModifications);
    addToHistory(newModifications);
  };

  const updateModification = (index: number, modification: VariantModification) => {
    const newModifications = [...modifications];
    newModifications[index] = modification;
    setModifications(newModifications);
    addToHistory(newModifications);
  };

  const removeModification = (index: number) => {
    const newModifications = modifications.filter((_, i) => i !== index);
    setModifications(newModifications);
    addToHistory(newModifications);
  };

  const addToHistory = (mods: VariantModification[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(mods);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setModifications(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setModifications(history[historyIndex + 1]);
    }
  };

  const highlightElement = (selector: string) => {
    iframeRef.current?.contentWindow?.postMessage({
      type: 'highlightElement',
      selector
    }, '*');
  };

  const saveChanges = async () => {
    await onSave(modifications);
  };

  return (
    <div className="grid grid-cols-12 gap-4 h-[calc(100vh-200px)]">
      {/* Left Panel - Controls */}
      <div className="col-span-3 space-y-4 overflow-y-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Visual Editor</span>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={undo}
                  disabled={historyIndex === 0}
                >
                  <Undo className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={redo}
                  disabled={historyIndex === history.length - 1}
                >
                  <Redo className="h-4 w-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Editing Mode Toggle */}
              <div className="flex items-center justify-between">
                <Label>Editing Mode</Label>
                <Switch
                  checked={isEditing}
                  onCheckedChange={setIsEditing}
                />
              </div>

              {/* Selected Element Info */}
              {selectedElement && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm font-medium">Selected Element</p>
                  <code className="text-xs">{selectedElement}</code>
                </div>
              )}

              {/* Modification Tools */}
              <Tabs defaultValue="element">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="element">
                    <MousePointer className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="text">
                    <Type className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="style">
                    <Palette className="h-4 w-4" />
                  </TabsTrigger>
                  <TabsTrigger value="code">
                    <Code className="h-4 w-4" />
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="element" className="space-y-3">
                  <div className="space-y-2">
                    <Label>Action</Label>
                    <Select
                      onValueChange={(value) => {
                        if (selectedElement) {
                          addModification({
                            type: 'element',
                            target: selectedElement,
                            action: value
                          });
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hide">Hide</SelectItem>
                        <SelectItem value="show">Show</SelectItem>
                        <SelectItem value="remove">Remove</SelectItem>
                        <SelectItem value="duplicate">Duplicate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-3">
                  <div className="space-y-2">
                    <Label>Replace Text</Label>
                    <Input
                      placeholder="Original text"
                      onChange={(e) => {
                        if (selectedElement) {
                          addModification({
                            type: 'text',
                            target: e.target.value,
                            value: ''
                          });
                        }
                      }}
                    />
                    <Input
                      placeholder="New text"
                      onChange={(e) => {
                        if (modifications.length > 0) {
                          const lastMod = modifications[modifications.length - 1];
                          if (lastMod.type === 'text') {
                            updateModification(modifications.length - 1, {
                              ...lastMod,
                              value: e.target.value
                            });
                          }
                        }
                      }}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="style" className="space-y-3">
                  <div className="space-y-2">
                    <Label>CSS Properties</Label>
                    <Input placeholder="Property (e.g., color)" />
                    <Input placeholder="Value (e.g., #FF0000)" />
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        // Add style modification
                      }}
                    >
                      Add Style
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="code" className="space-y-3">
                  <div className="space-y-2">
                    <Label>Custom JavaScript</Label>
                    <Textarea
                      placeholder="// Your code here"
                      className="font-mono text-sm"
                      rows={6}
                    />
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() => {
                        // Add code modification
                      }}
                    >
                      Add Code
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Modifications List */}
        <Card>
          <CardHeader>
            <CardTitle>Modifications ({modifications.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {modifications.map((mod, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 border rounded-md"
                >
                  <div className="flex items-center gap-2">
                    {mod.type === 'element' && <MousePointer className="h-4 w-4" />}
                    {mod.type === 'text' && <Type className="h-4 w-4" />}
                    {mod.type === 'style' && <Palette className="h-4 w-4" />}
                    {mod.type === 'code' && <Code className="h-4 w-4" />}
                    <div>
                      <p className="text-sm font-medium">{mod.type}</p>
                      <p className="text-xs text-muted-foreground">{mod.target}</p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeModification(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button
          className="w-full"
          onClick={saveChanges}
          disabled={modifications.length === 0}
        >
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>

      {/* Right Panel - Preview */}
      <div className="col-span-9">
        <Card className="h-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Preview</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{variant.name}</Badge>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant={previewMode === 'desktop' ? 'default' : 'ghost'}
                    onClick={() => setPreviewMode('desktop')}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={previewMode === 'tablet' ? 'default' : 'ghost'}
                    onClick={() => setPreviewMode('tablet')}
                  >
                    <Target className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant={previewMode === 'mobile' ? 'default' : 'ghost'}
                    onClick={() => setPreviewMode('mobile')}
                  >
                    <Zap className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[calc(100%-80px)]">
            <div 
              className={`h-full mx-auto transition-all ${
                previewMode === 'mobile' ? 'max-w-sm' :
                previewMode === 'tablet' ? 'max-w-2xl' : 'w-full'
              }`}
            >
              <iframe
                ref={iframeRef}
                className="w-full h-full border-0"
                title="Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default VisualEditor;