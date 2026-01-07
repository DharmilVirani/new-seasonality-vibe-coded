'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadApi } from '@/lib/api';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
import { Upload, FileText, RefreshCw, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<FileList | null>(null);
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');

  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['upload-batches'],
    queryFn: async () => {
      const response = await uploadApi.listBatches();
      return response.data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files || files.length === 0) throw new Error('No files selected');
      
      const formData = new FormData();
      Array.from(files).forEach((file) => {
        formData.append('files', file);
      });
      formData.append('name', batchName || 'Unnamed Batch');
      formData.append('description', description);
      
      return uploadApi.createBatch(formData);
    },
    onSuccess: () => {
      toast.success('Files uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
      setFiles(null);
      setBatchName('');
      setDescription('');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Upload failed');
    },
  });

  const processMutation = useMutation({
    mutationFn: (batchId: string) => uploadApi.processBatch(batchId),
    onSuccess: () => {
      toast.success('Processing started!');
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Processing failed');
    },
  });

  const batches = batchesData?.batches || [];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-6 space-y-6">
        <h1 className="text-2xl font-bold">Admin Panel</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV Files</CardTitle>
              <CardDescription>
                Upload daily.csv files for processing. Files will be validated and imported into the database.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="batchName">Batch Name</Label>
                <Input
                  id="batchName"
                  placeholder="e.g., January 2024 Data"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Brief description of the upload"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="files">CSV Files</Label>
                <div className="border-2 border-dashed rounded-lg p-6 text-center">
                  <input
                    id="files"
                    type="file"
                    multiple
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                  <label htmlFor="files" className="cursor-pointer">
                    <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      {files && files.length > 0
                        ? `${files.length} file(s) selected`
                        : 'Click to select CSV files'}
                    </p>
                  </label>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() => uploadMutation.mutate()}
                disabled={!files || files.length === 0 || uploadMutation.isPending}
              >
                {uploadMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Files
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload Batches</CardTitle>
              <CardDescription>
                View and manage uploaded file batches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Loading />
              ) : batches.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No batches uploaded yet
                </p>
              ) : (
                <div className="space-y-3">
                  {batches.map((batch: any) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{batch.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.fileCount} files • {new Date(batch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(batch.status)}
                        <span className={cn(
                          'text-xs px-2 py-1 rounded',
                          batch.status === 'completed' && 'bg-green-100 text-green-800',
                          batch.status === 'failed' && 'bg-red-100 text-red-800',
                          batch.status === 'processing' && 'bg-blue-100 text-blue-800',
                          batch.status === 'pending' && 'bg-yellow-100 text-yellow-800'
                        )}>
                          {batch.status}
                        </span>
                        {batch.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => processMutation.mutate(batch.id)}
                            disabled={processMutation.isPending}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
