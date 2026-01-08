'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { uploadApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/ui/loading';
import { 
  Upload, FileText, RefreshCw, Play, CheckCircle, XCircle, 
  Clock, Cloud, Trash2, RotateCcw, Database, FileSpreadsheet, LogOut, Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { CalculatedDataSection } from '@/components/admin/GeneratedFilesSection';

interface BatchFile {
  id: string;
  fileName: string;
  status: string;
  recordsProcessed: number;
  error?: string;
  processedAt?: string;
}

interface BatchStatus {
  batchId: string;
  status: string;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  pendingFiles: number;
  progress: number;
  files: BatchFile[];
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, logout, isAuthenticated } = useAuthStore();
  
  // Check if user is admin
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'admin') {
      router.push('/');
      toast.error('Access denied. Admin only.');
    }
  }, [isAuthenticated, user, router]);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('upload');
  
  // Standard upload state
  const [files, setFiles] = useState<FileList | null>(null);
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');
  
  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkBatchId, setBulkBatchId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<BatchStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch batches
  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['upload-batches'],
    queryFn: async () => {
      const response = await uploadApi.listBatches();
      return response.data;
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['upload-stats'],
    queryFn: async () => {
      const response = await uploadApi.getStats();
      return response.data;
    },
  });

  // Poll for bulk batch status
  useEffect(() => {
    if (!bulkBatchId || !isProcessing) return;
    if (bulkStatus?.status === 'COMPLETED' || bulkStatus?.status === 'FAILED' || bulkStatus?.status === 'PARTIAL') {
      setIsProcessing(false);
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
      queryClient.invalidateQueries({ queryKey: ['upload-stats'] });
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await uploadApi.getBulkStatus(bulkBatchId);
        if (response.data.success) {
          setBulkStatus(response.data.data);
          
          if (['COMPLETED', 'FAILED', 'PARTIAL'].includes(response.data.data.status)) {
            setIsProcessing(false);
            queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
            queryClient.invalidateQueries({ queryKey: ['upload-stats'] });
          }
        }
      } catch (err) {
        console.error('Error polling batch status:', err);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [bulkBatchId, bulkStatus?.status, isProcessing, queryClient]);

  // Standard upload mutation
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

  // Process batch mutation
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

  // Delete batch mutation
  const deleteMutation = useMutation({
    mutationFn: (batchId: string) => uploadApi.deleteBatch(batchId),
    onSuccess: () => {
      toast.success('Batch deleted');
      queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Delete failed');
    },
  });

  // Bulk file selection
  const handleBulkFilesSelect = useCallback((e: React.ChangeEvent<HTMLInputElement> | { target: { files: File[] } }) => {
    const selected = Array.from(e.target.files || []).filter(f => f.name.endsWith('.csv'));

    if (selected.length === 0) {
      setError('Please select CSV files only');
      return;
    }

    if (selected.length > 500) {
      setError('Maximum 500 files per upload');
      return;
    }

    setBulkFiles(selected);
    setError(null);
  }, []);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.csv'));
      handleBulkFilesSelect({ target: { files: dropped } });
    }
  }, [handleBulkFilesSelect]);

  // Upload to MinIO using presigned URL
  const uploadToMinIO = async (file: File, presignedUrl: string) => {
    console.log('Uploading to MinIO:', { fileName: file.name, url: presignedUrl });
    
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        mode: 'cors',
      });

      console.log('MinIO upload response:', { 
        status: response.status, 
        ok: response.ok,
        statusText: response.statusText 
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('MinIO upload failed:', text);
        throw new Error(`Failed to upload ${file.name}: ${response.status} ${text}`);
      }
    } catch (err: any) {
      console.error('MinIO upload error:', err);
      throw err;
    }
  };

  // Bulk upload handler
  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      setError('Please select files first');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setError(null);
    setBulkStatus(null);

    try {
      // Step 1: Get presigned URLs
      const presignResponse = await uploadApi.getPresignedUrls(
        bulkFiles.map(f => ({ name: f.name, size: f.size }))
      );

      if (!presignResponse.data.success) {
        throw new Error(presignResponse.data.error || 'Failed to get upload URLs');
      }

      const { batchId, files: presignedFiles } = presignResponse.data.data;

      // Step 2: Upload files to MinIO
      const totalFiles = presignedFiles.length;
      let uploadedCount = 0;

      for (const fileInfo of presignedFiles) {
        if (fileInfo.uploadUrl) {
          const file = bulkFiles.find(f => f.name === fileInfo.fileName);
          if (file) {
            await uploadToMinIO(file, fileInfo.uploadUrl);
          }
        }
        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 50);
      }

      // Step 3: Trigger async processing
      const processResponse = await uploadApi.processBulk(
        batchId,
        presignedFiles.map((f: any) => f.objectKey),
        presignedFiles.map((f: any) => f.fileName)
      );

      if (!processResponse.data.success) {
        throw new Error(processResponse.data.error || 'Failed to start processing');
      }

      setBulkBatchId(batchId);
      setIsUploading(false);
      setIsProcessing(true);
      setUploadProgress(50);
      toast.success('Upload complete, processing started!');

    } catch (err: any) {
      setIsUploading(false);
      setError(err.message || 'Upload failed');
      toast.error(err.message || 'Upload failed');
    }
  };

  // Reset bulk upload
  const resetBulkUpload = () => {
    setBulkFiles([]);
    setBulkBatchId(null);
    setBulkStatus(null);
    setIsUploading(false);
    setIsProcessing(false);
    setUploadProgress(0);
    setError(null);
  };

  // Retry failed files
  const handleRetry = async () => {
    if (!bulkBatchId) return;
    
    try {
      await uploadApi.retryBulk(bulkBatchId);
      setIsProcessing(true);
      toast.success('Retrying failed files...');
    } catch (err: any) {
      toast.error(err.message || 'Retry failed');
    }
  };

  const batches = batchesData?.batches || [];
  const stats = statsData?.data;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      FAILED: 'bg-red-100 text-red-800',
      PARTIAL: 'bg-orange-100 text-orange-800',
    };
    return badges[status] || 'bg-gray-100 text-gray-800';
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Don't render if not admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin Header - Isolated from main app */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="h-6 w-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
              <p className="text-xs text-gray-500">Seasonality Data Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user.name} ({user.email})
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-6 px-4 space-y-6">

        {/* Tabs */}
        <div className="border-b">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm",
                activeTab === 'upload'
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              <Upload className="h-4 w-4 mr-2 inline" />
              Upload Data
            </button>
            <button
              onClick={() => setActiveTab('data')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm",
                activeTab === 'data'
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              <Database className="h-4 w-4 mr-2 inline" />
              Calculated Data
            </button>
            <button
              onClick={() => setActiveTab('batches')}
              className={cn(
                "py-2 px-1 border-b-2 font-medium text-sm",
                activeTab === 'batches'
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
              )}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2 inline" />
              Upload History
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-6">
            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Database className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.totalTickers}</p>
                        <p className="text-sm text-muted-foreground">Total Tickers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.totalDataEntries?.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">Data Entries</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="text-2xl font-bold">{stats.averageEntriesPerTicker}</p>
                        <p className="text-sm text-muted-foreground">Avg per Ticker</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Bulk Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Bulk CSV Upload
              </CardTitle>
              <CardDescription>
                Upload multiple CSV files at once (up to 500 files)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200",
                  dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-300",
                  error ? "border-red-300 bg-red-50" : ""
                )}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  multiple
                  accept=".csv"
                  onChange={handleBulkFilesSelect as any}
                  className="hidden"
                  id="bulk-file-upload"
                  disabled={isUploading || isProcessing}
                />

                {!bulkStatus ? (
                  <div className="space-y-4">
                    <Cloud className={cn(
                      "mx-auto h-12 w-12",
                      dragActive ? "text-blue-500" : "text-gray-400"
                    )} />

                    <div>
                      <label
                        htmlFor="bulk-file-upload"
                        className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Click to browse or drag and drop
                      </label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Select multiple CSV files (max 500)
                      </p>
                    </div>

                    {bulkFiles.length > 0 && (
                      <div className="text-left max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-gray-700">
                            {bulkFiles.length} files selected
                          </span>
                          <button
                            onClick={() => setBulkFiles([])}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Clear all
                          </button>
                        </div>
                        <ul className="space-y-1 text-sm text-gray-600">
                          {bulkFiles.slice(0, 10).map((file, i) => (
                            <li key={i} className="flex items-center justify-between">
                              <span className="truncate flex-1">{file.name}</span>
                              <span className="text-gray-400 ml-2">{formatFileSize(file.size)}</span>
                            </li>
                          ))}
                          {bulkFiles.length > 10 && (
                            <li className="text-gray-400 italic">
                              ... and {bulkFiles.length - 10} more files
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="flex justify-center gap-3">
                      <Button
                        onClick={handleBulkUpload}
                        disabled={isUploading || bulkFiles.length === 0}
                      >
                        {isUploading ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload & Process
                          </>
                        )}
                      </Button>

                      {bulkFiles.length > 0 && !isUploading && (
                        <Button variant="outline" onClick={resetBulkUpload}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  /* Processing Status Display */
                  <div className="space-y-4 text-left">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">Batch Processing</h3>
                      <span className={cn(
                        "px-3 py-1 rounded-full text-sm font-medium",
                        getStatusBadge(bulkStatus.status)
                      )}>
                        {bulkStatus.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div>
                      <div className="flex justify-between text-sm text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{bulkStatus.progress.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-4">
                        <div
                          className={cn(
                            "h-4 rounded-full transition-all duration-500",
                            bulkStatus.status === 'FAILED' ? 'bg-red-500' :
                            bulkStatus.status === 'COMPLETED' ? 'bg-green-500' :
                            'bg-blue-500'
                          )}
                          style={{ width: `${bulkStatus.progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-gray-50 rounded-lg p-2">
                        <div className="text-xl font-bold">{bulkStatus.totalFiles}</div>
                        <div className="text-xs text-gray-500">Total</div>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2">
                        <div className="text-xl font-bold text-green-600">{bulkStatus.processedFiles}</div>
                        <div className="text-xs text-gray-500">Done</div>
                      </div>
                      <div className="bg-red-50 rounded-lg p-2">
                        <div className="text-xl font-bold text-red-600">{bulkStatus.failedFiles}</div>
                        <div className="text-xs text-gray-500">Failed</div>
                      </div>
                      <div className="bg-blue-50 rounded-lg p-2">
                        <div className="text-xl font-bold text-blue-600">{bulkStatus.pendingFiles}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                    </div>

                    {/* File List */}
                    {bulkStatus.files && bulkStatus.files.length > 0 && (
                      <div className="max-h-48 overflow-y-auto border rounded">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 sticky top-0">
                            <tr>
                              <th className="text-left p-2">File</th>
                              <th className="text-left p-2">Status</th>
                              <th className="text-left p-2">Records</th>
                              <th className="text-left p-2">Details</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkStatus.files.map((file, i) => (
                              <tr key={i} className="border-b border-gray-100">
                                <td className="p-2 truncate max-w-[150px]" title={file.fileName}>
                                  {file.fileName}
                                </td>
                                <td className="p-2">
                                  <span className={cn(
                                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                                    getStatusBadge(file.status)
                                  )}>
                                    {getStatusIcon(file.status)}
                                    {file.status}
                                  </span>
                                </td>
                                <td className="p-2">{file.recordsProcessed || '-'}</td>
                                <td className="p-2">
                                  {file.error ? (
                                    <div className="max-w-[200px]">
                                      <details className="cursor-pointer">
                                        <summary className="text-red-600 hover:text-red-800 text-xs">
                                          View Error
                                        </summary>
                                        <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 whitespace-pre-wrap">
                                          {file.error}
                                        </div>
                                      </details>
                                    </div>
                                  ) : file.status === 'COMPLETED' ? (
                                    <span className="text-green-600 text-xs">✓ Success</span>
                                  ) : (
                                    <span className="text-gray-400 text-xs">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Actions */}
                    {['COMPLETED', 'FAILED', 'PARTIAL'].includes(bulkStatus.status) && (
                      <div className="flex justify-center gap-3 pt-4 border-t">
                        <Button onClick={resetBulkUpload}>
                          <Upload className="h-4 w-4 mr-2" />
                          Upload More
                        </Button>

                        {bulkStatus.status === 'PARTIAL' && (
                          <Button variant="outline" onClick={handleRetry}>
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Retry Failed
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center p-3 bg-red-100 border border-red-200 rounded-md">
                  <XCircle className="text-red-600 mr-2 h-4 w-4" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Batches List Card */}
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
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {batches.map((batch: any) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{batch.name || 'Unnamed Batch'}</p>
                          <p className="text-xs text-muted-foreground">
                            {batch.totalFiles} files • {batch.totalRecordsProcessed?.toLocaleString() || 0} records
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(batch.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(batch.status)}
                        <span className={cn(
                          'text-xs px-2 py-1 rounded',
                          getStatusBadge(batch.status)
                        )}>
                          {batch.status}
                        </span>
                        {batch.status === 'PENDING' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => processMutation.mutate(batch.id)}
                            disabled={processMutation.isPending}
                          >
                            <Play className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(batch.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* File Requirements */}
        <Card>
          <CardHeader>
            <CardTitle>File Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              <li>File format: CSV (.csv)</li>
              <li>Maximum 500 files per upload batch</li>
              <li>Required columns: Date, Ticker, Close</li>
              <li>Optional columns: Open, High, Low, Volume, OpenInterest</li>
              <li>Date formats supported: DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD</li>
              <li>Processing happens asynchronously - you can leave this page</li>
            </ul>
          </CardContent>
        </Card>
          </div>
        )}

        {/* Calculated Data Tab */}
        {activeTab === 'data' && (
          <CalculatedDataSection />
        )}

        {/* Upload History Tab */}
        {activeTab === 'batches' && (
          <div className="space-y-6">
            {/* Recent Batches */}
            <Card>
              <CardHeader>
                <CardTitle>Upload History</CardTitle>
                <CardDescription>Recent upload batches and their status</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loading />
                  </div>
                ) : batchesData?.batches?.length > 0 ? (
                  <div className="space-y-3">
                    {batchesData.batches.map((batch: any) => (
                      <div key={batch.id} className="border rounded-lg">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex-1">
                            <h3 className="font-medium">{batch.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {batch.totalFiles} files • {batch.totalRecordsProcessed?.toLocaleString() || 0} records
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Created {new Date(batch.createdAt).toLocaleDateString()}
                            </p>
                            {batch.errorSummary && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-red-600 hover:text-red-800 text-sm">
                                  View Errors ({batch.failedFiles} failed files)
                                </summary>
                                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                  <pre className="whitespace-pre-wrap font-mono text-xs">
                                    {typeof batch.errorSummary === 'string' 
                                      ? batch.errorSummary 
                                      : JSON.stringify(batch.errorSummary, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              getStatusBadge(batch.status)
                            )}>
                              {batch.status}
                            </span>
                            {batch.status === 'PENDING' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => processMutation.mutate(batch.id)}
                                disabled={processMutation.isPending}
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => deleteMutation.mutate(batch.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No upload batches found
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

