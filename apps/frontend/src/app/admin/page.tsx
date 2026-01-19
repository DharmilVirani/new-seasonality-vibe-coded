'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { uploadApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import {Button}  from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Upload, FileText, RefreshCw, Play, CheckCircle, XCircle, 
  Clock, Cloud, Trash2, RotateCcw, Database, FileSpreadsheet, LogOut, Settings,
  AlertCircle, Activity, Layers, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Loading, PageLoader } from '@/components/ui/loading';
import { CalculatedDataSection } from '@/components/admin/GeneratedFilesSection';
import { ErrorPopover } from '@/components/ui/ErrorPopover';

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
  currentFile?: string; // Current file being processed with progress info
  files: BatchFile[];
}

// Helper function to calculate granular progress including current file's progress
const calculateGranularProgress = (bulkStatus: BatchStatus): number => {
  if (!bulkStatus || bulkStatus.totalFiles === 0) return 0;
  
  // Base progress from completed files
  const completedFiles = bulkStatus.processedFiles + bulkStatus.failedFiles;
  const baseProgress = (completedFiles / bulkStatus.totalFiles) * 100;
  
  // Try to extract current file's progress from currentFile string (e.g., "filename (45%) - Processing")
  if (bulkStatus.currentFile && bulkStatus.status === 'PROCESSING') {
    const match = bulkStatus.currentFile.match(/\((\d+)%\)/);
    if (match) {
      const currentFileProgress = parseInt(match[1], 10);
      // Add the current file's contribution to overall progress
      const perFileContribution = 100 / bulkStatus.totalFiles;
      const currentFileContribution = (currentFileProgress / 100) * perFileContribution;
      return Math.min(baseProgress + currentFileContribution, 100);
    }
  }
  
  return baseProgress;
};

export default function AdminPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user, logout, isAuthenticated, checkAuth, _hasHydrated } = useAuthStore();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  
  // Wait for store hydration and check auth
  useEffect(() => {
    if (!_hasHydrated) {
      console.log('Admin page: Waiting for store to hydrate...');
      return;
    }

    const checkAndLoad = async () => {
      console.log('Admin page: Store hydrated, checking auth...');
      setIsAuthChecking(true);
      await checkAuth();
      setIsAuthChecking(false);
      setHasCheckedAuth(true);
    };
    
    checkAndLoad();
  }, [checkAuth, _hasHydrated]);
  
  // Check if user is admin (only after auth check is complete)
  useEffect(() => {
    if (!hasCheckedAuth) return;
    
    if (!isAuthenticated) {
      console.log('Admin page: Not authenticated, redirecting to login');
      router.push('/login');
      return;
    }
    if (user?.role !== 'admin') {
      console.log('Admin page: Not admin, redirecting to home');
      router.push('/');
      toast.error('Access denied. Admin only.');
    }
  }, [hasCheckedAuth, isAuthenticated, user, router]);
  
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

  // Error popover state
  const [errorAnchor, setErrorAnchor] = useState<DOMRect | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

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
        return <CheckCircle className="h-4 w-4 text-emerald-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-rose-600" />;
      case 'processing':
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-amber-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
      PROCESSING: 'bg-blue-100 text-blue-800 border-blue-200',
      COMPLETED: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      FAILED: 'bg-rose-100 text-rose-800 border-rose-200',
      PARTIAL: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return badges[status] || 'bg-slate-100 text-slate-800 border-slate-200';
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Show loading while checking auth
  if (isAuthChecking || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Checking authentication..." />
      </div>
    );
  }

  // Don't render if not admin (only after auth check is complete)
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Redirecting..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20 font-sans text-slate-900">
      {/* Admin Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 shadow-md">
              <Settings className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight tracking-tight text-slate-900">Admin Panel</h1>
              <p className="text-xs font-medium text-slate-500">Seasonality Data Management</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right md:block">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="border-slate-200 bg-white hover:bg-slate-50 hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-6 space-y-8">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-200 pb-1">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={cn(
                "group relative py-3 text-sm font-medium transition-colors hover:text-blue-600",
                activeTab === 'upload' ? "text-blue-600" : "text-slate-500"
              )}
            >
              <span className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Upload Data
              </span>
              <span className={cn(
                "absolute -bottom-[5px] left-0 h-[3px] w-full rounded-full transition-all duration-300",
                activeTab === 'upload' ? "bg-blue-600 opacity-100" : "bg-transparent opacity-0 group-hover:bg-blue-200 group-hover:opacity-100"
              )} />
            </button>

            <button
              onClick={() => setActiveTab('data')}
              className={cn(
                "group relative py-3 text-sm font-medium transition-colors hover:text-blue-600",
                activeTab === 'data' ? "text-blue-600" : "text-slate-500"
              )}
            >
              <span className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Calculated Data
              </span>
              <span className={cn(
                "absolute -bottom-[5px] left-0 h-[3px] w-full rounded-full transition-all duration-300",
                activeTab === 'data' ? "bg-blue-600 opacity-100" : "bg-transparent opacity-0 group-hover:bg-blue-200 group-hover:opacity-100"
              )} />
            </button>

            <button
              onClick={() => setActiveTab('batches')}
              className={cn(
                "group relative py-3 text-sm font-medium transition-colors hover:text-blue-600",
                activeTab === 'batches' ? "text-blue-600" : "text-slate-500"
              )}
            >
              <span className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Upload History
              </span>
              <span className={cn(
                "absolute -bottom-[5px] left-0 h-[3px] w-full rounded-full transition-all duration-300",
                activeTab === 'batches' ? "bg-blue-600 opacity-100" : "bg-transparent opacity-0 group-hover:bg-blue-200 group-hover:opacity-100"
              )} />
            </button>
          </nav>
        </div>

        {/* Upload Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Overview */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Tickers</p>
                        <h3 className="mt-2 text-3xl font-bold text-slate-900">{stats.totalTickers}</h3>
                      </div>
                      <div className="rounded-full bg-blue-50 p-3">
                        <Database className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Total Entries</p>
                        <h3 className="mt-2 text-3xl font-bold text-slate-900">{stats.totalDataEntries?.toLocaleString()}</h3>
                      </div>
                      <div className="rounded-full bg-emerald-50 p-3">
                        <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-500">Avg per Ticker</p>
                        <h3 className="mt-2 text-3xl font-bold text-slate-900">{stats.averageEntriesPerTicker}</h3>
                      </div>
                      <div className="rounded-full bg-purple-50 p-3">
                        <FileText className="h-6 w-6 text-purple-600" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Main Upload Area */}
              <div className="xl:col-span-2 space-y-6">
                <Card className="border-0 shadow-xl shadow-slate-200/40 ring-1 ring-slate-200 rounded-2xl overflow-hidden bg-white">
                  <CardHeader className="border-b border-slate-50 bg-white px-8 py-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                            <Cloud className="h-5 w-5" />
                         </div>
                         <div>
                            <CardTitle className="text-lg font-bold text-slate-900">Batch Upload</CardTitle>
                            <CardDescription>Drag and drop your CSV files to process</CardDescription>
                         </div>
                      </div>
                      {bulkStatus && (
                         <div className="flex items-center gap-2">
                             <span className={cn(
                               "relative flex h-3 w-3",
                               bulkStatus.status === 'PROCESSING' ? "block" : "hidden"
                             )}>
                               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                               <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                             </span>
                             <span className={cn(
                               "text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider",
                               getStatusBadge(bulkStatus.status)
                             )}>
                               {bulkStatus.status}
                             </span>
                         </div>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="p-0">
                    <div
                      className={cn(
                        "relative flex flex-col transition-all duration-300 min-h-[420px]",
                        dragActive ? "bg-indigo-50/30" : "bg-white"
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
                        className="absolute inset-0 cursor-pointer opacity-0 z-10"
                        id="bulk-file-upload"
                        disabled={isUploading || isProcessing}
                      />

                      {!bulkStatus ? (
                         <div className="flex flex-col items-center justify-center flex-1 p-8">
                           {bulkFiles.length === 0 ? (
                              <div className="text-center space-y-6 max-w-sm mx-auto py-12">
                                <div className={cn(
                                  "mx-auto h-24 w-24 rounded-full flex items-center justify-center transition-all duration-300",
                                  dragActive ? "bg-indigo-100 scale-110" : "bg-slate-50 border-2 border-dashed border-slate-200"
                                )}>
                                   <Upload className={cn(
                                     "h-10 w-10 transition-colors",
                                     dragActive ? "text-indigo-600" : "text-slate-400"
                                   )} />
                                </div>
                                <div className="space-y-2">
                                   <h3 className="text-xl font-bold text-slate-900">
                                     Drop CSV files here
                                   </h3>
                                   <p className="text-slate-500">
                                      Or click to browse from your computer. <br/>
                                      <span className="text-xs text-slate-400">Max 500 files per batch.</span>
                                   </p>
                                </div>
                                <div className="pt-2">
                                   <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full px-8 h-12 shadow-lg shadow-indigo-200">
                                      Select Files
                                   </Button>
                                </div>
                              </div>
                           ) : (
                              <div className="w-full h-full flex flex-col items-center max-w-2xl mx-auto space-y-6 py-6 z-20 relative">
                                 <div className="w-full flex items-center justify-between">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                                      <Layers className="h-5 w-5 text-indigo-600" />
                                      Selected Files ({bulkFiles.length})
                                    </h3>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={(e) => { e.stopPropagation(); setBulkFiles([]); }}
                                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    >
                                      Clear All
                                    </Button>
                                 </div>
                                 
                                 <div className="w-full flex-1 bg-slate-50/80 rounded-xl border border-slate-200 overflow-hidden shadow-inner max-h-[250px] overflow-y-auto">
                                    <div className="divide-y divide-slate-100">
                                       {bulkFiles.map((file, i) => (
                                          <div key={i} className="flex items-center justify-between p-3 hover:bg-white transition-colors">
                                             <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                                                   <FileSpreadsheet className="h-4 w-4" />
                                                </div>
                                                <div className="min-w-0">
                                                   <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                                   <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                                                </div>
                                             </div>
                                             <div className="h-2 w-2 rounded-full bg-indigo-400"></div>
                                          </div>
                                       ))}
                                    </div>
                                 </div>

                                 <div className="w-full flex justify-center gap-4 pt-4">
                                    <Button 
                                      onClick={(e) => { e.stopPropagation(); handleBulkUpload(); }}
                                      disabled={isUploading}
                                      className="w-full sm:w-auto min-w-[200px] h-11 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200/50"
                                    >
                                       {isUploading ? (
                                          <>
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                            Uploading & Processing...
                                          </>
                                       ) : (
                                          <>
                                            <Cloud className="h-4 w-4 mr-2" />
                                            Start Upload Process
                                          </>
                                       )}
                                    </Button>
                                 </div>
                              </div>
                           )}
                         </div>
                      ) : (
                        /* Processing View */
                        <div className="flex flex-col h-full z-20 relative bg-white">
                           {/* Progress Section */}
                           <div className="bg-slate-50/50 px-8 py-6 border-b border-slate-100">
                              {/* Buttons row */}
                              <div className="flex justify-end gap-2 mb-4">
                                 {['COMPLETED', 'FAILED', 'PARTIAL'].includes(bulkStatus.status) && (
                                    <Button size="sm" onClick={resetBulkUpload} variant="outline" className="h-9">
                                       Upload More
                                    </Button>
                                 )}
                                 {bulkStatus.status === 'PARTIAL' && (
                                    <Button size="sm" onClick={handleRetry} className="h-9 bg-amber-500 hover:bg-amber-600 text-white">
                                       <RotateCcw className="h-3.5 w-3.5 mr-2" /> Retry Failed
                                    </Button>
                                 )}
                              </div>
                              
                              {/* Progress bar with percentage inside */}
                              {(() => {
                                const granularProgress = calculateGranularProgress(bulkStatus);
                                return (
                                  <div className="h-8 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner relative">
                                    <div 
                                      className={cn(
                                        "h-full rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden",
                                        bulkStatus.status === 'FAILED' ? 'bg-rose-500' :
                                        bulkStatus.status === 'COMPLETED' ? 'bg-emerald-500' :
                                        'bg-indigo-600'
                                      )}
                                      style={{ width: `${granularProgress}%` }} 
                                    >
                                      <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div>
                                    </div>
                                    {/* Percentage text centered on progress bar */}
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <span className={cn(
                                        "text-sm font-bold",
                                        granularProgress > 50 ? "text-white" : "text-slate-700"
                                      )}>
                                        {granularProgress.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                );
                              })()}
                              
                              <div className="grid grid-cols-4 gap-4 mt-8">
                                 <div className="bg-white rounded-xl border border-slate-100 p-3 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-slate-800">{bulkStatus.totalFiles}</span>
                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">Total Files</span>
                                 </div>
                                 <div className="bg-emerald-50 rounded-xl border border-emerald-100 p-3 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-emerald-600">{bulkStatus.processedFiles}</span>
                                    <span className="text-[10px] uppercase font-bold text-emerald-600/70 tracking-wider mt-1">Success</span>
                                 </div>
                                 <div className="bg-rose-50 rounded-xl border border-rose-100 p-3 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-rose-600">{bulkStatus.failedFiles}</span>
                                    <span className="text-[10px] uppercase font-bold text-rose-600/70 tracking-wider mt-1">Failed</span>
                                 </div>
                                 <div className="bg-indigo-50 rounded-xl border border-indigo-100 p-3 shadow-sm flex flex-col items-center">
                                    <span className="text-2xl font-bold text-indigo-600">{bulkStatus.pendingFiles}</span>
                                    <span className="text-[10px] uppercase font-bold text-indigo-600/70 tracking-wider mt-1">Pending</span>
                                 </div>
                              </div>
                              
                              {/* Current file progress */}
                              {bulkStatus.currentFile && bulkStatus.status === 'PROCESSING' && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                                  <div className="flex items-center gap-2 text-sm text-blue-700">
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                    <span className="font-medium truncate">{bulkStatus.currentFile}</span>
                                  </div>
                                </div>
                              )}
                           </div>

                           {/* File List Table */}
                           <div className="flex-1 overflow-hidden flex flex-col bg-white">
                              <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/30 flex items-center gap-2">
                                 <Activity className="h-4 w-4 text-slate-400" />
                                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">File Processing Log</span>
                              </div>
                              <div className="overflow-y-auto flex-1 p-0">
                                 <table className="w-full text-left">
                                    <tbody className="divide-y divide-slate-50">
                                       {bulkStatus.files.map((file, i) => (
                                          <tr key={i} className={cn(
                                             "transition-colors group",
                                             file.status === 'FAILED' ? "bg-rose-50/20 hover:bg-rose-50/40" : "hover:bg-slate-50"
                                          )}>
                                             <td className="px-6 py-4 w-[40%]">
                                                <div className="flex items-center gap-3">
                                                   <div className={cn(
                                                      "p-2 rounded-lg shrink-0",
                                                      file.status === 'FAILED' ? "bg-rose-100 text-rose-600" :
                                                      file.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" :
                                                      "bg-slate-100 text-slate-400"
                                                   )}>
                                                      <FileText className="h-4 w-4" />
                                                   </div>
                                                   <div className="min-w-0">
                                                      <p className="text-sm font-medium text-slate-700 truncate" title={file.fileName}>{file.fileName}</p>
                                                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                                         {file.recordsProcessed ? `${file.recordsProcessed} records` : 'Processing...'}
                                                      </p>
                                                   </div>
                                                </div>
                                             </td>
                                             <td className="px-6 py-4 w-[25%]">
                                                {file.status === 'COMPLETED' ? (
                                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                                                      <Check className="h-3 w-3" /> Processed
                                                   </span>
                                                ) : file.status === 'FAILED' ? (
                                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-medium border border-rose-100">
                                                      <XCircle className="h-3 w-3" /> Failed
                                                   </span>
                                                ) : (
                                                   <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100">
                                                      <RefreshCw className="h-3 w-3 animate-spin" /> Working
                                                   </span>
                                                )}
                                             </td>
                                            <td className="px-6 py-4 w-[35%] text-right">
                                              {file.error ? (
                                                <button
                                                  onClick={(e) => {
                                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                    setErrorAnchor(rect);
                                                    setActiveError(file.error!);
                                                  }}
                                                  className="inline-flex items-center gap-2 text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                                                >
                                                  <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 hover:bg-rose-100 transition-colors">
                                                    <AlertCircle className="h-3.5 w-3.5" />
                                                    Error
                                                  </span>
                                                </button>
                                              ) : (
                                                <span className="text-slate-300 text-xs font-medium">—</span>
                                              )}
                                            </td>

                                          </tr>
                                       ))}
                                    </tbody>
                                 </table>
                              </div>
                           </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {error && (
                  <div className="mt-6 flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl shadow-sm animate-in slide-in-from-top-2">
                    <div className="bg-rose-100 p-2 rounded-full">
                      <XCircle className="text-rose-600 h-5 w-5" />
                    </div>
                    <span className="text-rose-700 text-sm font-medium">{error}</span>
                  </div>
                )}
              </div>

              {/* Sidebar: Batches & Requirements */}
              <div className="space-y-6">
                <Card className="border-0 shadow-lg shadow-slate-200/40 ring-1 ring-slate-200 h-[calc(100%-1rem)] flex flex-col bg-white">
                  <CardHeader className="bg-white border-b border-slate-50 py-5 px-6">
                    <CardTitle className="text-base font-bold text-slate-800">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 flex-1 space-y-8">
                     <div className="space-y-4">
                        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 p-5 border border-indigo-100 shadow-sm">
                          <div className="flex items-center gap-2 text-indigo-700 font-bold mb-3 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            File Requirements
                          </div>
                          <ul className="space-y-3 text-xs text-indigo-900/80">
                            <li className="flex items-center gap-2">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-400"></div>
                               Format: <strong>CSV (.csv)</strong> only
                            </li>
                            <li className="flex items-center gap-2">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-400"></div>
                               Max files: <strong>500</strong> per batch
                            </li>
                            <li className="flex items-center gap-2">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-400"></div>
                               Required: Date, Ticker, Close
                            </li>
                            <li className="flex items-center gap-2">
                               <div className="h-1.5 w-1.5 rounded-full bg-indigo-400"></div>
                               Formats: YYYY-MM-DD or DD-MM-YYYY
                            </li>
                          </ul>
                        </div>
                     </div>

                     <div>
                       <h4 className="text-sm font-bold text-slate-800 mb-4 flex items-center justify-between">
                         Recent Uploads
                         <Button variant="outline" size="sm" className="h-auto p-0 text-xs text-indigo-600 font-medium" onClick={() => setActiveTab('batches')}>View all</Button>
                       </h4>
                       
                       {isLoading ? (
                          <div className="flex justify-center py-4"><Loading /></div>
                       ) : batches.length === 0 ? (
                          <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                             <p className="text-xs text-slate-400 italic">No recent uploads found</p>
                          </div>
                       ) : (
                          <div className="space-y-3">
                            {batches.slice(0, 5).map((batch: any) => (
                              <div key={batch.id} className="group flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-white hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-100/50 transition-all cursor-default">
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-700 truncate group-hover:text-indigo-700 transition-colors">{batch.name || 'Unnamed Batch'}</p>
                                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1.5">
                                    <Clock className="h-3 w-3" />
                                    {new Date(batch.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className={cn("h-2.5 w-2.5 rounded-full shadow-sm ring-2 ring-white", 
                                  batch.status === 'COMPLETED' ? "bg-emerald-500" :
                                  batch.status === 'FAILED' ? "bg-rose-500" : "bg-amber-500"
                                )} title={batch.status} />
                              </div>
                            ))}
                          </div>
                       )}
                     </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* Calculated Data Tab */}
        {activeTab === 'data' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <CalculatedDataSection />
          </div>
        )}

        {/* Upload History Tab */}
        {activeTab === 'batches' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">Upload History</CardTitle>
                    <CardDescription>Manage your previous data uploads</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['upload-batches'] })}>
                    <RefreshCw className="h-3.5 w-3.5 mr-2" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex justify-center py-12">
                    <Loading />
                  </div>
                ) : batchesData?.batches?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {batchesData.batches.map((batch: any) => (
                      <div key={batch.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 hover:bg-slate-50 transition-colors group">
                        <div className="flex items-start gap-4 mb-4 sm:mb-0">
                          <div className={cn(
                            "rounded-full p-2.5 mt-1 shrink-0",
                            batch.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-600" :
                            batch.status === 'FAILED' ? "bg-rose-50 text-rose-600" :
                            "bg-blue-50 text-blue-600"
                          )}>
                             {batch.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> : 
                              batch.status === 'FAILED' ? <XCircle className="h-5 w-5" /> : 
                              <RefreshCw className="h-5 w-5" />}
                          </div>
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900">{batch.name || 'Unnamed Batch'}</h3>
                              <span className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                                getStatusBadge(batch.status)
                              )}>
                                {batch.status}
                              </span>
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5" />
                                {batch.totalFiles} files
                              </span>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <span className="flex items-center gap-1.5">
                                <Database className="h-3.5 w-3.5" />
                                {batch.totalRecordsProcessed?.toLocaleString() || 0} records
                              </span>
                              <span className="hidden sm:inline text-slate-300">•</span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {new Date(batch.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            {batch.errorSummary && (
                              <div className="mt-2">
                                <button
                                  onClick={(e) => {
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    setErrorAnchor(rect);
                                    setActiveError(typeof batch.errorSummary === 'string' 
                                      ? batch.errorSummary 
                                      : JSON.stringify(batch.errorSummary, null, 2));
                                  }}
                                  className="cursor-pointer text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  View Error Summary ({batch.failedFiles} failed)
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity self-end sm:self-center">
                          {batch.status === 'PENDING' && (
                            <Button
                              size="sm"
                              className="bg-blue-600 text-white hover:bg-blue-700 h-8 text-xs"
                              onClick={() => processMutation.mutate(batch.id)}
                              disabled={processMutation.isPending}
                            >
                              <Play className="h-3 w-3 mr-1.5" />
                              Process
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-8 w-8 p-0"
                            onClick={() => deleteMutation.mutate(batch.id)}
                            disabled={deleteMutation.isPending}
                            title="Delete Batch"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <FileSpreadsheet className="h-8 w-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-900">No uploads yet</h3>
                    <p className="text-slate-500 max-w-sm mt-1 mb-6">Upload your first batch of CSV files to get started with seasonality data processing.</p>
                    <Button onClick={() => setActiveTab('upload')} variant="outline">
                      Go to Upload
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Error Popover Portal */}
      {errorAnchor && activeError && (
        <ErrorPopover
          anchorRect={errorAnchor}
          error={activeError}
          onClose={() => {
            setErrorAnchor(null);
            setActiveError(null);
          }}
        />
      )}
    </div>
  );
}