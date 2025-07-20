'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Type, 
  Image, 
  MousePointer, 
  Minus, 
  Plus, 
  Palette, 
  Eye, 
  Send, 
  Save,
  Sparkles,
  Layout,
  Smartphone,
  Monitor
} from 'lucide-react';

interface EmailBlock {
  id: string;
  type: 'text' | 'heading' | 'image' | 'button' | 'divider' | 'spacer' | 'product' | 'products_grid';
  content: Record<string, any>;
  styles: Record<string, any>;
}

interface EmailBuilderProps {
  templateId?: string;
  onSave?: (blocks: EmailBlock[], settings: any) => void;
  onPreview?: (blocks: EmailBlock[], settings: any) => void;
  onSend?: (blocks: EmailBlock[], settings: any) => void;
}

export default function EmailBuilder({ templateId, onSave, onPreview, onSend }: EmailBuilderProps) {
  const [blocks, setBlocks] = useState<EmailBlock[]>([
    {
      id: '1',
      type: 'heading',
      content: { text: 'Welcome to our newsletter!' },
      styles: { fontSize: '32px', color: '#333333', textAlign: 'center' }
    },
    {
      id: '2',
      type: 'text',
      content: { text: 'This is your personalized email content. Click to edit and customize.' },
      styles: { fontSize: '16px', color: '#666666', lineHeight: '1.4' }
    }
  ]);

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [globalSettings, setGlobalSettings] = useState({
    width: 600,
    backgroundColor: '#f6f9fc',
    fontFamily: 'system-ui',
    brandColors: {
      primary: '#007bff',
      secondary: '#6c757d',
      accent: '#28a745'
    }
  });

  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    'Add personalization with {{firstName}}',
    'Include a clear call-to-action button',
    'Use engaging subject line with urgency',
    'Add social proof or testimonials'
  ]);

  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');

  const addBlock = (type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: Date.now().toString(),
      type,
      content: getDefaultContent(type),
      styles: getDefaultStyles(type)
    };

    setBlocks([...blocks, newBlock]);
  };

  const getDefaultContent = (type: EmailBlock['type']) => {
    switch (type) {
      case 'heading':
        return { text: 'Your Heading Here' };
      case 'text':
        return { text: 'Your text content goes here. You can personalize it with variables like {{firstName}}.' };
      case 'image':
        return { src: '', alt: 'Image description', url: '' };
      case 'button':
        return { text: 'Click Here', url: '#' };
      case 'divider':
        return {};
      case 'spacer':
        return { height: 20 };
      case 'product':
        return { 
          productId: '', 
          showPrice: true, 
          showDescription: true, 
          buttonText: 'Shop Now' 
        };
      case 'products_grid':
        return { 
          productIds: [], 
          columns: 3, 
          showPrices: true, 
          showDescriptions: false 
        };
      default:
        return {};
    }
  };

  const getDefaultStyles = (type: EmailBlock['type']) => {
    switch (type) {
      case 'heading':
        return { 
          fontSize: '24px', 
          color: '#333333', 
          textAlign: 'left', 
          fontWeight: 'bold',
          marginBottom: '16px'
        };
      case 'text':
        return { 
          fontSize: '16px', 
          color: '#666666', 
          lineHeight: '1.4',
          marginBottom: '16px'
        };
      case 'button':
        return { 
          backgroundColor: '#007bff', 
          color: '#ffffff', 
          padding: '12px 24px',
          borderRadius: '6px',
          textAlign: 'center',
          fontSize: '16px',
          fontWeight: 'bold'
        };
      case 'divider':
        return { 
          borderColor: '#eaeaea', 
          marginTop: '16px', 
          marginBottom: '16px' 
        };
      case 'spacer':
        return { height: '20px' };
      default:
        return {};
    }
  };

  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    setBlocks(blocks.map(block => 
      block.id === blockId ? { ...block, ...updates } : block
    ));
  };

  const deleteBlock = (blockId: string) => {
    setBlocks(blocks.filter(block => block.id !== blockId));
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const index = blocks.findIndex(block => block.id === blockId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= blocks.length) return;

    const newBlocks = [...blocks];
    [newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const generateAISuggestions = async () => {
    // Simulate AI analysis
    const suggestions = [
      'Consider adding a testimonial block for social proof',
      'Your subject line could be more engaging - try adding emojis',
      'Add a sense of urgency with a limited-time offer',
      'Include product recommendations based on user behavior',
      'Add a clear unsubscribe link in the footer'
    ];
    
    setAiSuggestions(suggestions);
  };

  const renderBlockEditor = () => {
    const selectedBlock = blocks.find(block => block.id === selectedBlockId);
    if (!selectedBlock) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          Select a block to edit its properties
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold capitalize">{selectedBlock.type} Block</h3>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => deleteBlock(selectedBlock.id)}
          >
            Delete
          </Button>
        </div>

        {/* Content editing based on block type */}
        {(selectedBlock.type === 'heading' || selectedBlock.type === 'text') && (
          <div className="space-y-2">
            <Label>Text Content</Label>
            <Textarea
              value={selectedBlock.content.text || ''}
              onChange={(e) => updateBlock(selectedBlock.id, {
                content: { ...selectedBlock.content, text: e.target.value }
              })}
              placeholder="Enter your text here..."
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              Use variables: {{firstName}}, {{lastName}}, {{email}}
            </p>
          </div>
        )}

        {selectedBlock.type === 'image' && (
          <div className="space-y-2">
            <div>
              <Label>Image URL</Label>
              <Input
                value={selectedBlock.content.src || ''}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  content: { ...selectedBlock.content, src: e.target.value }
                })}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div>
              <Label>Alt Text</Label>
              <Input
                value={selectedBlock.content.alt || ''}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  content: { ...selectedBlock.content, alt: e.target.value }
                })}
                placeholder="Image description"
              />
            </div>
            <div>
              <Label>Link URL (optional)</Label>
              <Input
                value={selectedBlock.content.url || ''}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  content: { ...selectedBlock.content, url: e.target.value }
                })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        )}

        {selectedBlock.type === 'button' && (
          <div className="space-y-2">
            <div>
              <Label>Button Text</Label>
              <Input
                value={selectedBlock.content.text || ''}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  content: { ...selectedBlock.content, text: e.target.value }
                })}
                placeholder="Click Here"
              />
            </div>
            <div>
              <Label>Button URL</Label>
              <Input
                value={selectedBlock.content.url || ''}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  content: { ...selectedBlock.content, url: e.target.value }
                })}
                placeholder="https://example.com"
              />
            </div>
          </div>
        )}

        {/* Style editing */}
        <div className="border-t pt-4 space-y-4">
          <h4 className="font-medium">Styling</h4>
          
          {(selectedBlock.type === 'heading' || selectedBlock.type === 'text' || selectedBlock.type === 'button') && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Font Size</Label>
                <Select
                  value={selectedBlock.styles.fontSize || '16px'}
                  onValueChange={(value) => updateBlock(selectedBlock.id, {
                    styles: { ...selectedBlock.styles, fontSize: value }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12px">12px</SelectItem>
                    <SelectItem value="14px">14px</SelectItem>
                    <SelectItem value="16px">16px</SelectItem>
                    <SelectItem value="18px">18px</SelectItem>
                    <SelectItem value="20px">20px</SelectItem>
                    <SelectItem value="24px">24px</SelectItem>
                    <SelectItem value="32px">32px</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={selectedBlock.styles.color || '#333333'}
                  onChange={(e) => updateBlock(selectedBlock.id, {
                    styles: { ...selectedBlock.styles, color: e.target.value }
                  })}
                />
              </div>
            </div>
          )}

          {selectedBlock.type === 'button' && (
            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={selectedBlock.styles.backgroundColor || '#007bff'}
                onChange={(e) => updateBlock(selectedBlock.id, {
                  styles: { ...selectedBlock.styles, backgroundColor: e.target.value }
                })}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEmailPreview = () => {
    const previewWidth = previewMode === 'mobile' ? '375px' : '600px';
    
    return (
      <div 
        className="mx-auto border rounded-lg overflow-hidden bg-white"
        style={{ 
          width: previewWidth,
          minHeight: '400px',
          backgroundColor: globalSettings.backgroundColor 
        }}
      >
        <div className="p-4 space-y-4">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={`cursor-pointer transition-all ${
                selectedBlockId === block.id ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => setSelectedBlockId(block.id)}
            >
              {block.type === 'heading' && (
                <h1 style={block.styles}>{block.content.text}</h1>
              )}
              
              {block.type === 'text' && (
                <p style={block.styles}>{block.content.text}</p>
              )}
              
              {block.type === 'image' && (
                <img
                  src={block.content.src || '/placeholder-image.jpg'}
                  alt={block.content.alt}
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              )}
              
              {block.type === 'button' && (
                <div style={{ textAlign: 'center', margin: '16px 0' }}>
                  <a
                    href={block.content.url}
                    style={{
                      ...block.styles,
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    {block.content.text}
                  </a>
                </div>
              )}
              
              {block.type === 'divider' && (
                <hr style={block.styles} />
              )}
              
              {block.type === 'spacer' && (
                <div style={{ height: block.content.height || 20 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen flex">
      {/* Sidebar - Block Library */}
      <div className="w-80 border-r bg-muted/50 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Email Builder</h2>
          <p className="text-sm text-muted-foreground">Drag blocks to build your email</p>
        </div>

        <Tabs defaultValue="blocks" className="flex-1 flex flex-col">
          <TabsList className="m-4">
            <TabsTrigger value="blocks">Blocks</TabsTrigger>
            <TabsTrigger value="ai">AI Assist</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="blocks" className="flex-1 p-4 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('heading')}
              >
                <Type className="h-6 w-6" />
                <span className="text-xs">Heading</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('text')}
              >
                <Type className="h-6 w-6" />
                <span className="text-xs">Text</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('image')}
              >
                <Image className="h-6 w-6" />
                <span className="text-xs">Image</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('button')}
              >
                <MousePointer className="h-6 w-6" />
                <span className="text-xs">Button</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('divider')}
              >
                <Minus className="h-6 w-6" />
                <span className="text-xs">Divider</span>
              </Button>
              
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-1"
                onClick={() => addBlock('spacer')}
              >
                <Plus className="h-6 w-6" />
                <span className="text-xs">Spacer</span>
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="ai" className="flex-1 p-4 space-y-4">
            <Button 
              onClick={generateAISuggestions}
              className="w-full"
              variant="outline"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Generate AI Suggestions
            </Button>
            
            <div className="space-y-2">
              <h3 className="font-medium">AI Recommendations</h3>
              {aiSuggestions.map((suggestion, index) => (
                <Card key={index} className="p-3">
                  <p className="text-sm">{suggestion}</p>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 p-4 space-y-4">
            <div>
              <Label>Email Width</Label>
              <Input
                type="number"
                value={globalSettings.width}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  width: parseInt(e.target.value) || 600
                })}
              />
            </div>
            
            <div>
              <Label>Background Color</Label>
              <Input
                type="color"
                value={globalSettings.backgroundColor}
                onChange={(e) => setGlobalSettings({
                  ...globalSettings,
                  backgroundColor: e.target.value
                })}
              />
            </div>
            
            <div>
              <Label>Font Family</Label>
              <Select
                value={globalSettings.fontFamily}
                onValueChange={(value) => setGlobalSettings({
                  ...globalSettings,
                  fontFamily: value
                })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system-ui">System UI</SelectItem>
                  <SelectItem value="Arial">Arial</SelectItem>
                  <SelectItem value="Georgia">Georgia</SelectItem>
                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col">
        {/* Preview Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant={previewMode === 'desktop' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreviewMode('desktop')}
            >
              <Monitor className="h-4 w-4 mr-1" />
              Desktop
            </Button>
            <Button
              variant={previewMode === 'mobile' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPreviewMode('mobile')}
            >
              <Smartphone className="h-4 w-4 mr-1" />
              Mobile
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onPreview?.(blocks, globalSettings)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button variant="outline" onClick={() => onSave?.(blocks, globalSettings)}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
            <Button onClick={() => onSend?.(blocks, globalSettings)}>
              <Send className="h-4 w-4 mr-2" />
              Send Test
            </Button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 p-4 overflow-auto bg-gray-50">
          {renderEmailPreview()}
        </div>
      </div>

      {/* Right Sidebar - Block Editor */}
      <div className="w-80 border-l bg-muted/50 flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Block Editor</h3>
        </div>
        <div className="flex-1 overflow-auto">
          {renderBlockEditor()}
        </div>
      </div>
    </div>
  );
}