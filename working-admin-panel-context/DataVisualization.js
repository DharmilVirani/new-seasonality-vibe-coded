'use client'

import { useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { FaChartLine, FaChartBar } from 'react-icons/fa'

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    TimeScale,
    Filler
)

export default function DataVisualization({ data }) {
    const [chartType, setChartType] = useState('line')
    const [timeFrame, setTimeFrame] = useState('all')

    // Filter data based on time frame
    const filteredData = () => {
        if (timeFrame === 'all') return data

        const now = new Date()
        const pastDate = new Date()

        switch (timeFrame) {
            case '1m':
                pastDate.setMonth(now.getMonth() - 1)
                break
            case '3m':
                pastDate.setMonth(now.getMonth() - 3)
                break
            case '6m':
                pastDate.setMonth(now.getMonth() - 6)
                break
            case '1y':
                pastDate.setFullYear(now.getFullYear() - 1)
                break
            default:
                return data
        }

        return data.filter((item) => new Date(item.date) >= pastDate)
    }

    const chartData = filteredData()

    // Prepare data for charts
    const getChartData = () => {
        if (chartData.length === 0) return null

        const labels = chartData.map((item) => new Date(item.date))
        const closePrices = chartData.map((item) => item.close)
        const volumes = chartData.map((item) => item.volume)

        return {
            labels,
            datasets: [
                {
                    label: 'Close Price',
                    data: closePrices,
                    borderColor: 'rgb(59, 130, 246)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.1,
                    fill: chartType === 'line' ? true : false,
                    yAxisID: 'y',
                },
                {
                    label: 'Volume',
                    data: volumes,
                    borderColor: 'rgb(16, 185, 129)',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    type: 'bar',
                    yAxisID: 'y1',
                },
            ],
        }
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                type: 'time',
                time: {
                    unit: getTimeUnit(),
                    tooltipFormat: 'PPP',
                },
                title: {
                    display: true,
                    text: 'Date',
                },
            },
            y: {
                type: 'linear',
                display: true,
                position: 'left',
                title: {
                    display: true,
                    text: 'Price',
                },
            },
            y1: {
                type: 'linear',
                display: true,
                position: 'right',
                title: {
                    display: true,
                    text: 'Volume',
                },
                grid: {
                    drawOnChartArea: false,
                },
            },
        },
        plugins: {
            legend: {
                position: 'top',
            },
            title: {
                display: true,
                text: `${chartData.length > 0 ? chartData[0].ticker.symbol : ''} - Seasonality Analysis`,
                font: {
                    size: 16,
                },
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        if (context.dataset.yAxisID === 'y1') {
                            return `Volume: ${context.raw.toLocaleString()}`
                        }
                        return `Price: $${context.raw.toFixed(2)}`
                    },
                },
            },
        },
    }

    const getTimeUnit = () => {
        if (chartData.length <= 30) return 'day'
        if (chartData.length <= 90) return 'week'
        if (chartData.length <= 365) return 'month'
        return 'quarter'
    }

    const renderChart = () => {
        const data = getChartData()
        if (!data) return <div className='text-center py-8'>No data available</div>

        switch (chartType) {
            case 'line':
                return <Line data={data} options={chartOptions} />
            case 'bar':
                return <Bar data={data} options={chartOptions} />
            default:
                return <Line data={data} options={chartOptions} />
        }
    }

    return (
        <div className='mt-6'>
            <div className='flex flex-wrap gap-4 mb-4'>
                <div className='flex items-center gap-2'>
                    <span className='font-medium text-gray-700'>Chart Type:</span>
                    <select
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        className='px-3 py-1 border border-gray-300 rounded-md text-sm'
                    >
                        <option value='line'>Line Chart</option>
                        <option value='bar'>Bar Chart</option>
                    </select>
                </div>

                <div className='flex items-center gap-2'>
                    <span className='font-medium text-gray-700'>Time Frame:</span>
                    <select
                        value={timeFrame}
                        onChange={(e) => setTimeFrame(e.target.value)}
                        className='px-3 py-1 border border-gray-300 rounded-md text-sm'
                    >
                        <option value='all'>All Time</option>
                        <option value='1y'>1 Year</option>
                        <option value='6m'>6 Months</option>
                        <option value='3m'>3 Months</option>
                        <option value='1m'>1 Month</option>
                    </select>
                </div>
            </div>

            <div className='bg-white rounded-lg shadow-sm border border-gray-200 p-4'>
                <div className='h-96'>{renderChart()}</div>
            </div>

            {chartData.length > 0 && (
                <div className='mt-4 grid grid-cols-2 md:grid-cols-4 gap-4'>
                    <div className='bg-gray-50 rounded-lg p-4 text-center'>
                        <div className='text-2xl font-bold text-blue-600'>
                            ${chartData[chartData.length - 1].close.toFixed(2)}
                        </div>
                        <div className='text-sm text-gray-600 mt-1'>Current Price</div>
                    </div>

                    <div className='bg-gray-50 rounded-lg p-4 text-center'>
                        <div className='text-2xl font-bold text-green-600'>
                            ${Math.max(...chartData.map((item) => item.high)).toFixed(2)}
                        </div>
                        <div className='text-sm text-gray-600 mt-1'>Period High</div>
                    </div>

                    <div className='bg-gray-50 rounded-lg p-4 text-center'>
                        <div className='text-2xl font-bold text-red-600'>
                            ${Math.min(...chartData.map((item) => item.low)).toFixed(2)}
                        </div>
                        <div className='text-sm text-gray-600 mt-1'>Period Low</div>
                    </div>

                    <div className='bg-gray-50 rounded-lg p-4 text-center'>
                        <div className='text-2xl font-bold text-purple-600'>{chartData.length}</div>
                        <div className='text-sm text-gray-600 mt-1'>Data Points</div>
                    </div>
                </div>
            )}
        </div>
    )
}
