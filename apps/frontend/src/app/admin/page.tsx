'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { uploadApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { Button } from '@/components/ui/button';
import { 
  Upload, FileText, RefreshCw, Play, CheckCircle, XCircle, 
  Clock, Trash2, RotateCcw, Database, FileSpreadsheet, LogOut,
  AlertCircle, Activity, Layers, Check, Moon, Sun, ArrowRight,
  TrendingUp, BarChart3, FileCheck, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { Loading } from '@/components/ui/loading';
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
  currentFile?: string;
  files: BatchFile[];
}

const calculateGranularProgress = (bulkStatus: BatchStatus): number => {
  if (!bulkStatus || bulkStatus.totalFiles === 0) return 0;
  const completedFiles = bulkStatus.processedFiles + bulkStatus.failedFiles;
  const baseProgress = (completedFiles / bulkStatus.totalFiles) * 100;
  if (bulkStatus.currentFile && bulkStatus.status === 'PROCESSING') {
    const match = bulkStatus.currentFile.match(/\((\d+)%\)/);
    if (match) {
      const currentFileProgress = parseInt(match[1], 10);
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
  const [darkMode, setDarkMode] = useState(false);
  
  useEffect(() => {
    if (!_hasHydrated) return;
    const checkAndLoad = async () => {
      setIsAuthChecking(true);
      await checkAuth();
      setIsAuthChecking(false);
      setHasCheckedAuth(true);
    };
    checkAndLoad();
  }, [checkAuth, _hasHydrated]);
  
  useEffect(() => {
    if (!hasCheckedAuth) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (user?.role !== 'admin') {
      router.push('/');
      toast.error('Access denied. Admin only.');
    }
  }, [hasCheckedAuth, isAuthenticated, user, router]);
  
  const [activeTab, setActiveTab] = useState('upload');
  const [files, setFiles] = useState<FileList | null>(null);
  const [batchName, setBatchName] = useState('');
  const [description, setDescription] = useState('');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkBatchId, setBulkBatchId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState<BatchStatus | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorAnchor, setErrorAnchor] = useState<DOMRect | null>(null);
  const [activeError, setActiveError] = useState<string | null>(null);

  const { data: batchesData, isLoading } = useQuery({
    queryKey: ['upload-batches'],
    queryFn: async () => {
      const response = await uploadApi.listBatches();
      return response.data;
    },
  });

  const { data: statsData } = useQuery({
    queryKey: ['upload-stats'],
    queryFn: async () => {
      const response = await uploadApi.getStats();
      return response.data;
    },
  });

  useEffect(() => {
    if (!bulkBatchId || !isProcessing) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const response = await uploadApi.getBulkStatus(bulkBatchId);
        if (response.data.success) {
          const newStatus = response.data.data;
          setBulkStatus(newStatus);
          
          // Stop polling when processing is complete
          if (['COMPLETED', 'FAILED', 'PARTIAL'].includes(newStatus.status)) {
            setIsProcessing(false);
            clearInterval(pollInterval);
            queryClient.invalidateQueries({ queryKey: ['upload-batches'] });
            queryClient.invalidateQueries({ queryKey: ['upload-stats'] });
          }
        }
      } catch (err) {
        console.error('Error polling batch status:', err);
      }
    }, 2000);
    
    return () => clearInterval(pollInterval);
  }, [bulkBatchId, isProcessing, queryClient]);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!files || files.length === 0) throw new Error('No files selected');
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));
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

  const uploadToMinIO = async (file: File, presignedUrl: string) => {
    const response = await fetch(presignedUrl, { method: 'PUT', body: file, mode: 'cors' });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Failed to upload ${file.name}: ${response.status} ${text}`);
    }
  };

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
      const presignResponse = await uploadApi.getPresignedUrls(bulkFiles.map(f => ({ name: f.name, size: f.size })));
      if (!presignResponse.data.success) throw new Error(presignResponse.data.error || 'Failed to get upload URLs');
      const { batchId, files: presignedFiles } = presignResponse.data.data;
      const totalFiles = presignedFiles.length;
      let uploadedCount = 0;
      for (const fileInfo of presignedFiles) {
        if (fileInfo.uploadUrl) {
          const file = bulkFiles.find(f => f.name === fileInfo.fileName);
          if (file) await uploadToMinIO(file, fileInfo.uploadUrl);
        }
        uploadedCount++;
        setUploadProgress((uploadedCount / totalFiles) * 50);
      }
      const processResponse = await uploadApi.processBulk(batchId, presignedFiles.map((f: any) => f.objectKey), presignedFiles.map((f: any) => f.fileName));
      if (!processResponse.data.success) throw new Error(processResponse.data.error || 'Failed to start processing');
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

  const resetBulkUpload = () => {
    setBulkFiles([]);
    setBulkBatchId(null);
    setBulkStatus(null);
    setIsUploading(false);
    setIsProcessing(false);
    setUploadProgress(0);
    setError(null);
  };

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

  const getStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      PENDING: 'bg-amber-100 text-amber-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-emerald-100 text-emerald-800',
      FAILED: 'bg-rose-100 text-rose-800',
      PARTIAL: 'bg-orange-100 text-orange-800',
    };
    return badges[status] || 'bg-slate-100 text-slate-800';
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (isAuthChecking || !hasCheckedAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Checking authentication..." />
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loading size="lg" text="Redirecting..." />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo & Nav */}
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-slate-900 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-slate-900 leading-tight">Admin Panel</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">Seasonality Management</p>
              </div>
            </div>
            
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setActiveTab('upload')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  activeTab === 'upload' 
                    ? "bg-slate-100 text-slate-900" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                Upload Data
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  activeTab === 'data' 
                    ? "bg-slate-100 text-slate-900" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                Calculated Data
              </button>
              <button
                onClick={() => setActiveTab('batches')}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all",
                  activeTab === 'batches' 
                    ? "bg-slate-100 text-slate-900" 
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                Upload History
              </button>
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            
            <div className="h-6 w-px bg-slate-200" />
            
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {activeTab === 'upload' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Tickers</p>
                  <h3 className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats?.totalTickers || 0}</h3>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Entries</p>
                  <h3 className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats?.totalDataEntries?.toLocaleString() || 0}</h3>
                </div>
              </div>
              
              <div className="bg-white rounded-2xl border border-slate-200 p-6 flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Avg Per Ticker</p>
                  <h3 className="text-4xl font-bold text-slate-900 mt-2 tracking-tight">{stats?.averageEntriesPerTicker?.toLocaleString() || 0}</h3>
                </div>
              </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Batch Upload - Left Column */}
              <div className="lg:col-span-3">
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900">Batch Upload</h2>
                        <p className="text-sm text-slate-400">Drag and drop your CSV files to process the data</p>
                      </div>
                    </div>
                  </div>

                  {/* Upload Area */}
                  <div className="p-6">
                    {!bulkStatus ? (
                      <div
                        className={cn(
                          "relative border-2 border-dashed rounded-2xl transition-all min-h-[320px] flex flex-col items-center justify-center",
                          dragActive ? "border-blue-400 bg-blue-50/50" : "border-slate-200 bg-slate-50/50",
                          bulkFiles.length > 0 && "border-solid border-slate-200 bg-white"
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
                          disabled={isUploading || isProcessing}
                        />

                        {bulkFiles.length === 0 ? (
                          <div className="text-center space-y-4 p-8">
                            <div className={cn(
                              "mx-auto h-16 w-16 rounded-full flex items-center justify-center transition-all",
                              dragActive ? "bg-blue-100" : "bg-slate-100"
                            )}>
                              <Upload className={cn("h-7 w-7", dragActive ? "text-blue-500" : "text-slate-400")} />
                            </div>
                            <div>
                              <h3 className="text-lg font-semibold text-slate-900">Drop CSV files here</h3>
                              <p className="text-sm text-slate-400 mt-1">Or click to browse from your computer.</p>
                              <p className="text-xs text-slate-400 mt-1">Maximum 500 files per batch upload.</p>
                            </div>
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 h-11 mt-2">
                              Select Files
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full p-4 space-y-4 relative z-20">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                <Layers className="h-4 w-4 text-slate-500" />
                                {bulkFiles.length} files selected
                              </h3>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => { e.stopPropagation(); setBulkFiles([]); }}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-8"
                              >
                                Clear All
                              </Button>
                            </div>
                            
                            <div className="max-h-[180px] overflow-y-auto space-y-2 pr-2">
                              {bulkFiles.slice(0, 10).map((file, i) => (
                                <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                                  <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                                    <FileSpreadsheet className="h-4 w-4" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                                    <p className="text-xs text-slate-400">{formatFileSize(file.size)}</p>
                                  </div>
                                </div>
                              ))}
                              {bulkFiles.length > 10 && (
                                <p className="text-xs text-slate-400 text-center py-2">
                                  +{bulkFiles.length - 10} more files
                                </p>
                              )}
                            </div>

                            <Button 
                              onClick={(e) => { e.stopPropagation(); handleBulkUpload(); }}
                              disabled={isUploading}
                              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl"
                            >
                              {isUploading ? (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  Uploading...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Start Upload
                                </>
                              )}
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Processing Status View */
                      <ProcessingView 
                        bulkStatus={bulkStatus}
                        resetBulkUpload={resetBulkUpload}
                        handleRetry={handleRetry}
                        setErrorAnchor={setErrorAnchor}
                        setActiveError={setActiveError}
                      />
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      Accepted format: .csv only
                    </div>
                    <div>Secure transmission SSL enabled</div>
                  </div>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
                    <XCircle className="text-rose-600 h-5 w-5 shrink-0" />
                    <span className="text-rose-700 text-sm font-medium">{error}</span>
                  </div>
                )}
              </div>

              {/* Right Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* File Requirements */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <h3 className="font-semibold text-slate-900">File Requirements</h3>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">Format</p>
                        <p className="text-xs text-slate-400">CSV (.csv) only, UTF-8 encoding</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">Max files</p>
                        <p className="text-xs text-slate-400">500 files per batch process</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="h-2 w-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                      <div>
                        <p className="font-medium text-slate-900 text-sm">Required Columns</p>
                        <p className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded mt-1">Date, Ticker, Close, Volume</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Recent Uploads */}
                <div className="bg-white rounded-2xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="font-semibold text-slate-900">Recent Uploads</h3>
                    <button 
                      onClick={() => setActiveTab('batches')}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      View all
                    </button>
                  </div>
                  
                  {isLoading ? (
                    <div className="flex justify-center py-8"><Loading /></div>
                  ) : batches.length === 0 ? (
                    <div className="text-center py-8 text-sm text-slate-400">No recent uploads</div>
                  ) : (
                    <div className="space-y-3">
                      {batches.slice(0, 4).map((batch: any) => (
                        <RecentUploadItem key={batch.id} batch={batch} />
                      ))}
                    </div>
                  )}
                </div>

                {/* Export Button */}
                <button className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-4 flex items-center justify-between transition-colors">
                  <span className="font-medium">Export Summary Report</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'data' && <CalculatedDataSection />}
        
        {activeTab === 'batches' && (
          <UploadHistoryTab 
            batches={batches}
            isLoading={isLoading}
            processMutation={processMutation}
            deleteMutation={deleteMutation}
            queryClient={queryClient}
            setActiveTab={setActiveTab}
            getStatusBadge={getStatusBadge}
            setErrorAnchor={setErrorAnchor}
            setActiveError={setActiveError}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <BarChart3 className="h-4 w-4" />
            <span>Seasonality Data Management Engine v2.4.1</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-slate-600 transition-colors">System Status</a>
            <a href="#" className="hover:text-slate-600 transition-colors">API Documentation</a>
            <a href="#" className="hover:text-slate-600 transition-colors">Contact Support</a>
          </div>
        </div>
      </footer>

      {errorAnchor && activeError && (
        <ErrorPopover
          anchorRect={errorAnchor}
          error={activeError}
          onClose={() => { setErrorAnchor(null); setActiveError(null); }}
        />
      )}
    </div>
  );
}


// Processing View Component
function ProcessingView({ 
  bulkStatus, 
  resetBulkUpload, 
  handleRetry,
  setErrorAnchor,
  setActiveError
}: { 
  bulkStatus: BatchStatus;
  resetBulkUpload: () => void;
  handleRetry: () => void;
  setErrorAnchor: (rect: DOMRect | null) => void;
  setActiveError: (error: string | null) => void;
}) {
  const granularProgress = calculateGranularProgress(bulkStatus);
  
  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center",
            bulkStatus.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" :
            bulkStatus.status === 'FAILED' ? "bg-rose-100 text-rose-600" :
            "bg-blue-100 text-blue-600"
          )}>
            {bulkStatus.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> :
             bulkStatus.status === 'FAILED' ? <XCircle className="h-5 w-5" /> :
             <RefreshCw className="h-5 w-5 animate-spin" />}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              {bulkStatus.status === 'COMPLETED' ? 'Upload Complete' :
               bulkStatus.status === 'FAILED' ? 'Upload Failed' :
               bulkStatus.status === 'PARTIAL' ? 'Partially Complete' :
               'Processing Files...'}
            </h3>
            <p className="text-sm text-slate-400">{bulkStatus.processedFiles} of {bulkStatus.totalFiles} files processed</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
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
      </div>

      {/* Progress Bar */}
      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
        <div 
          className={cn(
            "h-full rounded-full transition-all duration-500",
            bulkStatus.status === 'FAILED' ? 'bg-rose-500' :
            bulkStatus.status === 'COMPLETED' ? 'bg-emerald-500' :
            'bg-blue-500'
          )}
          style={{ width: `${granularProgress}%` }} 
        />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-slate-50 rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-slate-900">{bulkStatus.totalFiles}</span>
          <p className="text-xs text-slate-400 mt-1">Total</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-emerald-600">{bulkStatus.processedFiles}</span>
          <p className="text-xs text-emerald-600 mt-1">Success</p>
        </div>
        <div className="bg-rose-50 rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-rose-600">{bulkStatus.failedFiles}</span>
          <p className="text-xs text-rose-600 mt-1">Failed</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <span className="text-2xl font-bold text-blue-600">{bulkStatus.pendingFiles}</span>
          <p className="text-xs text-blue-600 mt-1">Pending</p>
        </div>
      </div>

      {/* Current File */}
      {bulkStatus.currentFile && bulkStatus.status === 'PROCESSING' && (
        <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
          <div className="flex items-center gap-2 text-sm text-blue-700">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="font-medium truncate">{bulkStatus.currentFile}</span>
          </div>
        </div>
      )}

      {/* File List */}
      {bulkStatus.files.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Processing Log</span>
          </div>
          <div className="max-h-[200px] overflow-y-auto divide-y divide-slate-100">
            {bulkStatus.files.map((file, i) => (
              <div key={i} className={cn(
                "flex items-center justify-between px-4 py-3",
                file.status === 'FAILED' && "bg-rose-50/50"
              )}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                    file.status === 'FAILED' ? "bg-rose-100 text-rose-600" :
                    file.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" :
                    "bg-slate-100 text-slate-400"
                  )}>
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.fileName}</p>
                    <p className="text-xs text-slate-400">
                      {file.recordsProcessed ? `${file.recordsProcessed} records` : 'Processing...'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {file.status === 'COMPLETED' && (
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Done
                    </span>
                  )}
                  {file.status === 'FAILED' && (
                    <button
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setErrorAnchor(rect);
                        setActiveError(file.error || 'Unknown error');
                      }}
                      className="text-xs font-medium text-rose-600 flex items-center gap-1 hover:text-rose-700"
                    >
                      <AlertCircle className="h-3.5 w-3.5" /> Error
                    </button>
                  )}
                  {file.status === 'PROCESSING' && (
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Recent Upload Item Component
function RecentUploadItem({ batch }: { batch: any }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-emerald-500';
      case 'FAILED': return 'bg-rose-500';
      case 'PROCESSING': return 'bg-blue-500';
      case 'PARTIAL': return 'bg-amber-500';
      default: return 'bg-slate-400';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED': return null;
      case 'FAILED': return 'Schema Mismatch';
      case 'PROCESSING': return 'Processing...';
      case 'PARTIAL': return 'Pending Validation';
      default: return status;
    }
  };

  const statusText = getStatusText(batch.status);

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
      <div className={cn("h-2 w-2 rounded-full mt-2 shrink-0", getStatusColor(batch.status))} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{batch.name || 'Unnamed Upload'}</p>
        {statusText ? (
          <p className={cn(
            "text-xs mt-0.5 flex items-center gap-1",
            batch.status === 'FAILED' ? "text-rose-500" :
            batch.status === 'PARTIAL' ? "text-amber-500" :
            "text-slate-400"
          )}>
            {batch.status === 'FAILED' && <AlertCircle className="h-3 w-3" />}
            {batch.status === 'PARTIAL' && <Clock className="h-3 w-3" />}
            {statusText}
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(batch.createdAt).toLocaleDateString('en-US', { 
              day: '2-digit', 
              month: 'short', 
              year: 'numeric' 
            })} · {new Date(batch.createdAt).toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            })}
          </p>
        )}
      </div>
    </div>
  );
}

// Upload History Tab Component
function UploadHistoryTab({ 
  batches, 
  isLoading, 
  processMutation, 
  deleteMutation, 
  queryClient,
  setActiveTab,
  getStatusBadge,
  setErrorAnchor,
  setActiveError
}: any) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Upload History</h2>
          <p className="text-sm text-slate-400">Manage your previous data uploads</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ['upload-batches'] })}
          className="h-9"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-16"><Loading /></div>
      ) : batches.length > 0 ? (
        <div className="divide-y divide-slate-100">
          {batches.map((batch: any) => (
            <div key={batch.id} className="flex items-center justify-between p-6 hover:bg-slate-50 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                  batch.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-600" :
                  batch.status === 'FAILED' ? "bg-rose-100 text-rose-600" :
                  "bg-blue-100 text-blue-600"
                )}>
                  {batch.status === 'COMPLETED' ? <CheckCircle className="h-5 w-5" /> : 
                   batch.status === 'FAILED' ? <XCircle className="h-5 w-5" /> : 
                   <RefreshCw className="h-5 w-5" />}
                </div>
                
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-slate-900">{batch.name || 'Unnamed Batch'}</h3>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", getStatusBadge(batch.status))}>
                      {batch.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-slate-400">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {batch.totalFiles} files
                    </span>
                    <span className="flex items-center gap-1">
                      <Database className="h-3.5 w-3.5" />
                      {batch.totalRecordsProcessed?.toLocaleString() || 0} records
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(batch.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {batch.errorSummary && (
                    <button
                      onClick={(e) => {
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setErrorAnchor(rect);
                        setActiveError(typeof batch.errorSummary === 'string' 
                          ? batch.errorSummary 
                          : JSON.stringify(batch.errorSummary, null, 2));
                      }}
                      className="mt-2 text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1"
                    >
                      <AlertCircle className="h-3 w-3" />
                      View Error Summary ({batch.failedFiles} failed)
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {batch.status === 'PENDING' && (
                  <Button
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700 h-9"
                    onClick={() => processMutation.mutate(batch.id)}
                    disabled={processMutation.isPending}
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />
                    Process
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 h-9 w-9 p-0"
                  onClick={() => deleteMutation.mutate(batch.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <FileSpreadsheet className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No uploads yet</h3>
          <p className="text-slate-400 max-w-sm mt-1 mb-6">Upload your first batch of CSV files to get started.</p>
          <Button onClick={() => setActiveTab('upload')} variant="outline">
            Go to Upload
          </Button>
        </div>
      )}
    </div>
  );
}
