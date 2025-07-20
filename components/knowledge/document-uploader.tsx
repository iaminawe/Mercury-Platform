'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  Upload, 
  FileText, 
  Image, 
  File, 
  X, 
  CheckCircle, 
  AlertCircle,
  RefreshCw,
  Settings
} from 'lucide-react';

type ContentType = 
  | 'product' 
  | 'customer' 
  | 'order' 
  | 'content' 
  | 'faq' 
  | 'knowledge_base' 
  | 'review' 
  | 'marketing' 
  | 'support_ticket' 
  | 'conversation';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  chunks?: number;
  error?: string;
  documentId?: string;
}

interface UploadSettings {
  contentType: ContentType;
  enableClustering: boolean;
  maxChunkSize: number;
  overlapSize: number;
  autoTitle: boolean;
  customMetadata: Record<string, string>;
}

interface DocumentUploaderProps {
  onUploadComplete?: () => void;
  maxFiles?: number;
  acceptedFileTypes?: string[];
}

export function DocumentUploader({ 
  onUploadComplete, 
  maxFiles = 10,
  acceptedFileTypes = ['.txt', '.md', '.pdf', '.docx', '.csv', '.json']
}: DocumentUploaderProps) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<UploadSettings>({
    contentType: 'knowledge_base',
    enableClustering: true,
    maxChunkSize: 1000,
    overlapSize: 100,
    autoTitle: true,
    customMetadata: {},
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      status: 'pending',
      progress: 0,
    }));

    setFiles(prev => [...prev, ...newFiles].slice(0, maxFiles));
  }, [maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/csv': ['.csv'],
      'application/json': ['.json'],
    },
    maxFiles,
    disabled: uploading,
  });

  const removeFile = (fileId: string) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    // Simple text extraction - in production, you'd use proper parsers
    const text = await file.text();
    
    if (file.type === 'application/json') {
      try {
        const json = JSON.parse(text);
        return JSON.stringify(json, null, 2);
      } catch {
        return text;
      }
    }
    
    return text;
  };

  const generateTitle = (filename: string, content: string): string => {
    if (!settings.autoTitle) return filename;
    
    // Extract title from content or use filename
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    const firstLine = lines[0]?.trim();
    
    if (firstLine && firstLine.length < 100 && firstLine.length > 5) {
      return firstLine.replace(/^#\s*/, ''); // Remove markdown header
    }
    
    return filename.replace(/\.[^/.]+$/, ''); // Remove extension
  };

  const uploadFile = async (uploadFile: UploadFile): Promise<void> => {
    try {
      // Update status to processing
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'processing', progress: 10 }
          : f
      ));

      // Extract text content
      const content = await extractTextFromFile(uploadFile.file);
      const title = generateTitle(uploadFile.file.name, content);

      // Simulate progress updates
      for (let progress = 20; progress <= 80; progress += 20) {
        setFiles(prev => prev.map(f => 
          f.id === uploadFile.id ? { ...f, progress } : f
        ));
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // In a real implementation, this would call your indexing API
      const indexingOptions = {
        contentType: settings.contentType,
        storeId: 'current-store-id', // Get from context
        enableClustering: settings.enableClustering,
        maxChunkSize: settings.maxChunkSize,
        overlapSize: settings.overlapSize,
        metadata: {
          ...settings.customMetadata,
          filename: uploadFile.file.name,
          fileSize: uploadFile.file.size,
          uploadDate: new Date().toISOString(),
        },
      };

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful response
      const mockDocumentId = Math.random().toString(36).substr(2, 9);
      const mockChunks = Math.ceil(content.length / settings.maxChunkSize);

      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'completed', 
              progress: 100, 
              documentId: mockDocumentId,
              chunks: mockChunks 
            }
          : f
      ));

    } catch (error) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: 'error', 
              error: error instanceof Error ? error.message : 'Upload failed' 
            }
          : f
      ));
    }
  };

  const uploadAllFiles = async () => {
    setUploading(true);
    
    try {
      const pendingFiles = files.filter(f => f.status === 'pending');
      
      // Upload files in batches to avoid overwhelming the system
      const batchSize = 3;
      for (let i = 0; i < pendingFiles.length; i += batchSize) {
        const batch = pendingFiles.slice(i, i + batchSize);
        await Promise.all(batch.map(file => uploadFile(file)));
      }

      // Call completion callback
      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Batch upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const retryFailedUploads = async () => {
    const failedFiles = files.filter(f => f.status === 'error');
    
    // Reset failed files to pending
    setFiles(prev => prev.map(f => 
      f.status === 'error' 
        ? { ...f, status: 'pending', progress: 0, error: undefined }
        : f
    ));

    // Upload failed files
    for (const file of failedFiles) {
      await uploadFile(file);
    }
  };

  const clearCompleted = () => {
    setFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  const addMetadataField = () => {
    const key = prompt('Enter metadata key:');
    if (key && !settings.customMetadata[key]) {
      setSettings(prev => ({
        ...prev,
        customMetadata: { ...prev.customMetadata, [key]: '' }
      }));
    }
  };

  const updateMetadataField = (key: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      customMetadata: { ...prev.customMetadata, [key]: value }
    }));
  };

  const removeMetadataField = (key: string) => {
    setSettings(prev => {
      const { [key]: removed, ...rest } = prev.customMetadata;
      return { ...prev, customMetadata: rest };
    });
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (file.type === 'application/pdf') return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
      default: return null;
    }
  };

  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;
  const processingCount = files.filter(f => f.status === 'processing').length;

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Upload Documents</CardTitle>
              <CardDescription>
                Upload documents to index them in your vector database
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Settings Panel */}
          {showSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contentType">Content Type</Label>
                    <Select
                      value={settings.contentType}
                      onValueChange={(value: ContentType) => 
                        setSettings(prev => ({ ...prev, contentType: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="knowledge_base">Knowledge Base</SelectItem>
                        <SelectItem value="faq">FAQ</SelectItem>
                        <SelectItem value="product">Product</SelectItem>
                        <SelectItem value="marketing">Marketing</SelectItem>
                        <SelectItem value="content">General Content</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="maxChunkSize">Max Chunk Size</Label>
                    <Input
                      id="maxChunkSize"
                      type="number"
                      value={settings.maxChunkSize}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        maxChunkSize: parseInt(e.target.value) || 1000 
                      }))}
                      min={500}
                      max={5000}
                    />
                  </div>

                  <div>
                    <Label htmlFor="overlapSize">Overlap Size</Label>
                    <Input
                      id="overlapSize"
                      type="number"
                      value={settings.overlapSize}
                      onChange={(e) => setSettings(prev => ({ 
                        ...prev, 
                        overlapSize: parseInt(e.target.value) || 100 
                      }))}
                      min={0}
                      max={500}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="enableClustering"
                      checked={settings.enableClustering}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, enableClustering: checked }))
                      }
                    />
                    <Label htmlFor="enableClustering">Enable Clustering</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Switch
                      id="autoTitle"
                      checked={settings.autoTitle}
                      onCheckedChange={(checked) => 
                        setSettings(prev => ({ ...prev, autoTitle: checked }))
                      }
                    />
                    <Label htmlFor="autoTitle">Auto-generate Titles</Label>
                  </div>
                </div>

                {/* Custom Metadata */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <Label>Custom Metadata</Label>
                    <Button variant="outline" size="sm" onClick={addMetadataField}>
                      Add Field
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(settings.customMetadata).map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <Input
                          placeholder="Key"
                          value={key}
                          disabled
                          className="flex-1"
                        />
                        <Input
                          placeholder="Value"
                          value={value}
                          onChange={(e) => updateMetadataField(key, e.target.value)}
                          className="flex-1"
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeMetadataField(key)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/10' 
                : 'border-muted-foreground/25 hover:border-primary/50'
            } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            {isDragActive ? (
              <p>Drop the files here...</p>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">
                  Drag & drop files here, or click to select
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports: {acceptedFileTypes.join(', ')} • Max {maxFiles} files
                </p>
              </div>
            )}
          </div>

          {/* Upload Summary */}
          {files.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {files.length} file{files.length !== 1 ? 's' : ''} ready to upload
                {completedCount > 0 && ` • ${completedCount} completed`}
                {errorCount > 0 && ` • ${errorCount} failed`}
                {processingCount > 0 && ` • ${processingCount} processing`}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File List */}
      {files.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Upload Queue</CardTitle>
              <div className="flex gap-2">
                {errorCount > 0 && (
                  <Button variant="outline" size="sm" onClick={retryFailedUploads}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Retry Failed
                  </Button>
                )}
                {completedCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    Clear Completed
                  </Button>
                )}
                <Button 
                  onClick={uploadAllFiles}
                  disabled={uploading || files.every(f => f.status !== 'pending')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload All
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {files.map((uploadFile) => (
                <div key={uploadFile.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getFileIcon(uploadFile.file)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">
                        {uploadFile.file.name}
                      </p>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          uploadFile.status === 'completed' ? 'default' :
                          uploadFile.status === 'error' ? 'destructive' :
                          uploadFile.status === 'processing' ? 'secondary' : 'outline'
                        }>
                          {uploadFile.status}
                        </Badge>
                        {getStatusIcon(uploadFile.status)}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {(uploadFile.file.size / 1024).toFixed(1)} KB
                        {uploadFile.chunks && ` • ${uploadFile.chunks} chunks`}
                      </span>
                      {uploadFile.documentId && (
                        <span>ID: {uploadFile.documentId}</span>
                      )}
                    </div>

                    {uploadFile.status === 'processing' && (
                      <Progress value={uploadFile.progress} className="mt-2" />
                    )}

                    {uploadFile.error && (
                      <p className="text-xs text-red-500 mt-1">{uploadFile.error}</p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeFile(uploadFile.id)}
                    disabled={uploadFile.status === 'processing'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}