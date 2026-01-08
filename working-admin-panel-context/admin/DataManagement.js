
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    Search, Download, Trash2, Eye, RefreshCcw,
    UploadCloud, FolderSearch, AlertTriangle, X,
    Calendar, Info, Loader2, PlusCircle
} from 'lucide-react';
import { showToast } from '@/components/admin/Toast.js';
import { BulkUpload } from '@/components/BulkUpload.js';

const API_BASE_URL = 'http://localhost:3001';

export const DataManagement = ({ onUpload }) => {
    const [tickData, setTickData] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTicker, setSelectedTicker] = useState(null);
    const [deletePreview, setDeletePreview] = useState(null);
    const [activeTab, setActiveTab] = useState('upload'); // 'browse' | 'upload'

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/data/tickers`);
            if (response.data.success) {
                setTickData(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching ticker data:', error);
            showToast('error', 'Failed to fetch ticker data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDeletePreview = async (ticker) => {
        try {
            setIsLoading(true);
            const response = await axios.get(`${API_BASE_URL}/api/ticker/${ticker.id}/preview`);
            if (response.data.success) {
                setDeletePreview({ ...response.data.data, ticker });
            }
        } catch (error) {
            showToast('error', 'Failed to load deletion preview');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletePreview?.ticker) return;
        try {
            setIsLoading(true);
            const response = await axios.delete(`${API_BASE_URL}/api/ticker/${deletePreview.ticker.id}`);
            if (response.data.success) {
                showToast('success', `Ticker ${deletePreview.ticker.symbol} deleted successfully`);
                setDeletePreview(null);
                fetchData();
            }
        } catch (error) {
            showToast('error', error.response?.data?.message || 'Failed to delete ticker');
        } finally {
            setIsLoading(false);
        }
    };

    const filteredData = tickData.filter((ticker) =>
        ticker.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Primary Action Switcher */}
            <div className="flex flex-col md:flex-row items-center justify-between border-b border-slate-100 pb-6 gap-4">
                <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-fit shadow-inner">
                    <button
                        onClick={() => setActiveTab('upload')}
                        className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'upload'
                            ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <UploadCloud className="w-5 h-5" />
                        <span>Upload Files</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('browse')}
                        className={`flex-1 md:flex-none flex items-center justify-center space-x-2 px-8 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${activeTab === 'browse'
                            ? 'bg-white text-indigo-600 shadow-md ring-1 ring-black/5'
                            : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <FolderSearch className="w-5 h-5" />
                        <span>Explore Inventory</span>
                    </button>

                </div>

                {activeTab === 'browse' && (
                    <button
                        onClick={() => setActiveTab('upload')}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-100 transition-all group"
                    >
                        <PlusCircle className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
                        <span>Quick Upload</span>
                    </button>
                )}
            </div>

            {activeTab === 'upload' ? (
                <div className="max-w-4xl mx-auto py-4">
                    <BulkUpload onUploadComplete={() => {
                        showToast('success', 'Files processed successfully');
                        setActiveTab('browse');
                        fetchData();
                    }} />
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-lg">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by ticker (e.g. AAPL, BTC)..."
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={fetchData}
                                title="Refresh Data"
                                className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-all text-slate-600 shadow-sm hover:shadow-md"
                            >
                                <RefreshCcw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
                            </button>
                            <button className="flex items-center space-x-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm hover:shadow-md">
                                <Download className="w-5 h-5" />
                                <span>Download Report</span>
                            </button>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-xl shadow-slate-200/50">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/80">
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Asset Name</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Engine Status</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest">Latest Sync</th>
                                    <th className="px-8 py-5 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {isLoading && filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-32 text-center">
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="p-4 bg-indigo-50 rounded-full">
                                                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                                </div>
                                                <p className="text-base font-bold text-slate-900">Synchronizing database...</p>
                                                <p className="text-sm text-slate-400">This may take a few seconds depending on network load.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredData.length > 0 ? (
                                    filteredData.map((ticker) => (
                                        <tr key={ticker.id} className="hover:bg-indigo-50/40 transition-colors group">
                                            <td className="px-8 py-5">
                                                <div className="flex items-center space-x-4">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm border border-indigo-100 group-hover:bg-white transition-all shadow-sm">
                                                        {ticker.symbol.substring(0, 2)}
                                                    </div>
                                                    <div>
                                                        <p className="text-base font-bold text-slate-900 leading-none">{ticker.symbol}</p>
                                                        <p className="text-[11px] text-slate-400 mt-1.5 font-mono uppercase tracking-tight">Ref: {ticker.id}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center space-x-2">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                                                    <span className="text-xs font-bold text-slate-600">Active Pool</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{new Date(ticker.updatedAt).toLocaleDateString()}</span>
                                                    <span className="text-[10px] text-slate-400 mt-1">{new Date(ticker.updatedAt).toLocaleTimeString()}</span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className="flex items-center justify-end space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => setSelectedTicker(ticker)}
                                                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-md transition-all"
                                                    >
                                                        <Eye className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePreview(ticker)}
                                                        className="p-2.5 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-rose-600 hover:border-rose-200 hover:shadow-md transition-all"
                                                    >
                                                        <Trash2 className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-8 py-24 text-center">
                                            <div className="flex flex-col items-center space-y-4">
                                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                                    <FolderSearch className="w-10 h-10 text-slate-200" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-lg font-bold text-slate-900">No assets detected</p>
                                                    <p className="text-sm text-slate-400 max-w-xs mx-auto">Your inventory is currently empty. Initialize your first upload to start analyzing seasonality.</p>
                                                </div>
                                                <button
                                                    onClick={() => setActiveTab('upload')}
                                                    className="mt-4 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
                                                >
                                                    Upload First File
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Ticker Details Modal */}
            {selectedTicker && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                                    <Info className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-black text-slate-900 leading-tight">Asset Profile</h3>
                                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Registry Details</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedTicker(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Trading Symbol</p>
                                    <p className="text-3xl font-black text-slate-900 tracking-tight">{selectedTicker.symbol}</p>
                                </div>
                                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Sync Stamp</p>
                                    <p className="text-sm font-bold text-slate-700">{new Date(selectedTicker.updatedAt).toLocaleDateString()}</p>
                                    <p className="text-xs text-slate-400 mt-1">{new Date(selectedTicker.updatedAt).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <div className="p-6 bg-indigo-50/50 rounded-[2rem] border border-indigo-100">
                                <div className="flex items-center space-x-3 mb-4">
                                    <RefreshCcw className="w-4 h-4 text-indigo-600" />
                                    <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest">Engine Parameters</h4>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-bold border-b border-indigo-100/50 pb-2">
                                        <span className="text-indigo-400">Internal Reference</span>
                                        <span className="text-indigo-900 font-mono">{selectedTicker.id}</span>
                                    </div>
                                    <div className="flex justify-between text-xs font-bold border-b border-indigo-100/50 pb-2">
                                        <span className="text-indigo-400">Recalculation Status</span>
                                        <span className="text-indigo-900">Compliant</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50 border-t border-slate-100 flex justify-end">
                            <button
                                onClick={() => setSelectedTicker(null)}
                                className="px-10 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-700 hover:bg-slate-100 transition-all shadow-md active:scale-95"
                            >
                                Close Profile
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deletePreview && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-10 space-y-8">
                            <div className="w-24 h-24 bg-rose-50 rounded-[2rem] flex items-center justify-center mx-auto border border-rose-100 shadow-inner">
                                <AlertTriangle className="w-10 h-10 text-rose-500" />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-2xl font-black text-slate-900">Remove Ticker?</h3>
                                <p className="text-sm text-slate-500 leading-relaxed px-4">
                                    You are about to purge <span className="font-bold text-slate-900 underline decoration-rose-200 decoration-2">{deletePreview.ticker.symbol}</span> and all associated calculation history. This cannot be undone.
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4">
                                <button
                                    onClick={() => setDeletePreview(null)}
                                    disabled={isLoading}
                                    className="px-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-black text-slate-600 hover:bg-slate-50 transition-all"
                                >
                                    Keep Data
                                </button>
                                <button
                                    onClick={handleDeleteConfirm}
                                    disabled={isLoading}
                                    className="px-6 py-4 bg-rose-600 text-white rounded-2xl text-sm font-black hover:bg-rose-700 shadow-xl shadow-rose-200 flex items-center justify-center transition-all active:scale-95"
                                >
                                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Purge'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
