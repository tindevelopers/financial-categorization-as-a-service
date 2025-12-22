'use client'

import { useState, useEffect } from 'react'
import { Heading, Text, Button } from '@/components/catalyst'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import dynamic from 'next/dynamic'

// Dynamically import ApexCharts to avoid SSR issues
const Chart = dynamic(() => import('react-apexcharts'), { ssr: false })

interface CategoryData {
  category: string
  total: number
  count: number
}

interface TrendData {
  date: string
  count: number
  amount: number
}

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('30d')
  const [categoryData, setCategoryData] = useState<CategoryData[]>([])
  const [trendData, setTrendData] = useState<TrendData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [period])

  async function fetchAnalytics() {
    setLoading(true)
    try {
      // Fetch category breakdown
      const categoryRes = await fetch('/api/analytics/spending-by-category')
      if (categoryRes.ok) {
        const categoryJson = await categoryRes.json()
        setCategoryData(categoryJson.categories || [])
      }

      // Fetch trends
      const trendsRes = await fetch(`/api/analytics/trends?period=${period}`)
      if (trendsRes.ok) {
        const trendsJson = await trendsRes.json()
        setTrendData(trendsJson.trends || [])
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  // Pie chart options
  const pieChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'donut',
      background: 'transparent',
    },
    labels: categoryData.map(c => c.category),
    theme: {
      mode: 'light',
    },
    legend: {
      position: 'bottom',
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: {
          width: 300
        },
        legend: {
          position: 'bottom'
        }
      }
    }],
    plotOptions: {
      pie: {
        donut: {
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total',
              formatter: () => {
                const total = categoryData.reduce((sum, c) => sum + c.total, 0)
                return `£${total.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`
              }
            }
          }
        }
      }
    }
  }

  const pieSeries = categoryData.map(c => c.total)

  // Line chart options
  const lineChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'area',
      background: 'transparent',
      toolbar: {
        show: true,
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      curve: 'smooth',
      width: 2,
    },
    xaxis: {
      categories: trendData.map(t => t.date),
      labels: {
        rotate: -45,
      }
    },
    yaxis: {
      labels: {
        formatter: (value) => `£${value.toFixed(0)}`
      }
    },
    theme: {
      mode: 'light',
    },
    fill: {
      type: 'gradient',
      gradient: {
        shadeIntensity: 1,
        opacityFrom: 0.7,
        opacityTo: 0.3,
      }
    },
    tooltip: {
      y: {
        formatter: (value) => `£${value.toFixed(2)}`
      }
    }
  }

  const lineSeries = [{
    name: 'Amount',
    data: trendData.map(t => t.amount)
  }]

  // Bar chart for transaction count
  const barChartOptions: ApexCharts.ApexOptions = {
    chart: {
      type: 'bar',
      background: 'transparent',
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
      }
    },
    dataLabels: {
      enabled: false,
    },
    xaxis: {
      categories: categoryData.map(c => c.category),
    },
    theme: {
      mode: 'light',
    },
    colors: ['#3b82f6'],
  }

  const barSeries = [{
    name: 'Transactions',
    data: categoryData.map(c => c.count)
  }]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading>Analytics</Heading>
          <Text>Visualize your spending patterns and trends</Text>
        </div>
        
        <div className="flex gap-2">
          <Button
            {...(period === '7d' ? { color: 'blue' } : { outline: true })}
            onClick={() => setPeriod('7d')}
          >
            7 Days
          </Button>
          <Button
            {...(period === '30d' ? { color: 'blue' } : { outline: true })}
            onClick={() => setPeriod('30d')}
          >
            30 Days
          </Button>
          <Button
            {...(period === '90d' ? { color: 'blue' } : { outline: true })}
            onClick={() => setPeriod('90d')}
          >
            90 Days
          </Button>
          <Button
            {...(period === '12m' ? { color: 'blue' } : { outline: true })}
            onClick={() => setPeriod('12m')}
          >
            12 Months
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20">
          <div className="animate-pulse">
            <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
            <Text>Loading analytics...</Text>
          </div>
        </div>
      ) : categoryData.length === 0 ? (
        <div className="text-center py-20">
          <ChartBarIcon className="h-12 w-12 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <Heading level={2} className="mb-2">No Data Available</Heading>
          <Text>Upload transactions to see analytics</Text>
        </div>
      ) : (
        <>
          {/* Spending Trend Over Time */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <Heading level={2} className="mb-4">
              Spending Trend
            </Heading>
            <div className="h-80">
              <Chart
                options={lineChartOptions}
                series={lineSeries}
                type="area"
                height="100%"
              />
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <Heading level={2} className="mb-4">
                Spending by Category
              </Heading>
              <div className="h-80">
                <Chart
                  options={pieChartOptions}
                  series={pieSeries}
                  type="donut"
                  height="100%"
                />
              </div>
            </div>

            {/* Bar Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
              <Heading level={2} className="mb-4">
                Transactions by Category
              </Heading>
              <div className="h-80">
                <Chart
                  options={barChartOptions}
                  series={barSeries}
                  type="bar"
                  height="100%"
                />
              </div>
            </div>
          </div>

          {/* Category Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
            <Heading level={2} className="mb-4">
              Category Details
            </Heading>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Total Amount
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {categoryData.map((cat, idx) => {
                    const totalAmount = categoryData.reduce((sum, c) => sum + c.total, 0)
                    const percentage = (cat.total / totalAmount) * 100
                    
                    return (
                      <tr key={idx}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {cat.category}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {cat.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          £{cat.total.toLocaleString('en-GB', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                          {percentage.toFixed(1)}%
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

