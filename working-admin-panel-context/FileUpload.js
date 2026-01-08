'use client'

import { useState, useRef } from 'react'
import { FaUpload, FaFileCsv, FaCheckCircle, FaTimesCircle } from 'react-icons/fa'

export default function FileUpload({ onFileUpload, isLoading }) {
    const [file, setFile] = useState(null)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [error, setError] = useState(null)
    const fileInputRef = useRef(null)

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0]

        if (!selectedFile) return

        // Validate file type
        if (!selectedFile.name.endsWith('.csv')) {
            setError('Please select a CSV file')
            return
        }

        // Validate file size (10MB limit)
        if (selectedFile.size > 10 * 1024 * 1024) {
            setError('File size exceeds 10MB limit')
            return
        }

        setFile(selectedFile)
        setError(null)
    }

    const handleUpload = () => {
        if (!file) {
            setError('Please select a file first')
            return
        }

        setUploadProgress(0)
        setError(null)

        // Simulate upload progress
        const interval = setInterval(() => {
            setUploadProgress((prev) => {
                if (prev >= 90) {
                    clearInterval(interval)
                    return 90
                }
                return prev + 10
            })
        }, 200)

        // Call the upload handler
        onFileUpload(file)
            .then(() => {
                clearInterval(interval)
                setUploadProgress(100)
                // Reset after successful upload
                setTimeout(() => {
                    setFile(null)
                    setUploadProgress(0)
                    if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                    }
                }, 2000)
            })
            .catch((err) => {
                clearInterval(interval)
                setUploadProgress(0)
                setError(err.message || 'Upload failed')
            })
    }

    const handleDrop = (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (e.type === 'dragover') {
            e.currentTarget.classList.add('border-blue-500', 'bg-blue-50')
            return
        }

        e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0]
            const event = { target: { files: [file] } }
            handleFileChange(event)
        }
    }

    return (
        <div className='space-y-4'>
            <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
                    error ? 'border-red-300 bg-red-50' : 'border-gray-300 hover:border-blue-300'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDrop}
                onDragLeave={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.remove('border-blue-500', 'bg-blue-50')
                }}
            >
                <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept='.csv'
                    className='hidden'
                    id='file-upload'
                    disabled={isLoading}
                />

                {file ? (
                    <div className='space-y-3'>
                        <FaFileCsv className='mx-auto text-4xl text-blue-600' />
                        <p className='font-medium text-gray-800'>{file.name}</p>
                        <p className='text-sm text-gray-500'>{Math.round(file.size / 1024)} KB</p>

                        {uploadProgress > 0 && (
                            <div className='w-full bg-gray-200 rounded-full h-2.5'>
                                <div
                                    className='bg-blue-600 h-2.5 rounded-full transition-all duration-200'
                                    style={{ width: `${uploadProgress}%` }}
                                ></div>
                            </div>
                        )}

                        <button
                            onClick={handleUpload}
                            disabled={isLoading || uploadProgress > 0}
                            className={`px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 ${
                                isLoading || uploadProgress > 0 ? 'opacity-50 cursor-not-allowed' : ''
                            }`}
                        >
                            {uploadProgress === 100 ? (
                                <>
                                    <FaCheckCircle className='inline mr-2' />
                                    Upload Complete
                                </>
                            ) : uploadProgress > 0 ? (
                                `Uploading... ${uploadProgress}%`
                            ) : (
                                <>
                                    <FaUpload className='inline mr-2' />
                                    Upload File
                                </>
                            )}
                        </button>
                    </div>
                ) : (
                    <div className='space-y-3'>
                        <FaUpload className='mx-auto text-4xl text-gray-400' />
                        <label
                            htmlFor='file-upload'
                            className='cursor-pointer text-blue-600 hover:text-blue-800 font-medium'
                        >
                            Click to browse or drag and drop
                        </label>
                        <p className='text-sm text-gray-500'>CSV files only (max 10MB)</p>
                    </div>
                )}
            </div>

            {error && (
                <div className='flex items-center p-3 bg-red-100 border border-red-200 rounded-md'>
                    <FaTimesCircle className='text-red-600 mr-2' />
                    <span className='text-red-700 text-sm'>{error}</span>
                </div>
            )}

            <div className='p-4 bg-gray-50 rounded-md text-sm'>
                <h4 className='font-medium text-gray-800 mb-2'>File Requirements:</h4>
                <ul className='list-disc list-inside space-y-1 text-gray-600'>
                    <li>File format: CSV (.csv)</li>
                    <li>Maximum size: 10MB</li>
                    <li>Required columns: Date, Ticker, Close</li>
                    <li>Optional columns: Open, High, Low, Volume, OpenInterest</li>
                    <li>Date format: YYYY-MM-DD</li>
                </ul>
            </div>
        </div>
    )
}
