import React from "react";

const AnalyticsPreview = () => {
  const analyticsData = {
    pageViews: { current: 12450, previous: 10890, change: 14.3 },
    uniqueVisitors: { current: 8930, previous: 7650, change: 16.7 },
    avgTimeOnPage: { current: 3.2, previous: 2.8, change: 14.3 },
    bounceRate: { current: 42.1, previous: 45.8, change: -8.1 },
  };

  const topPosts = [
    {
      id: 1,
      title: "Content Marketing Trends 2024",
      views: 2340,
      engagement: 89,
    },
    {
      id: 2,
      title: "SEO Best Practices Guide",
      views: 1890,
      engagement: 76,
    },
    {
      id: 3,
      title: "Social Media Strategy Tips",
      views: 1650,
      engagement: 82,
    },
  ];

  const getChangeColor = (change: number) => {
    if (change > 0) {
      return "text-green-600 dark:text-green-400";
    } else if (change < 0) {
      return "text-red-600 dark:text-red-400";
    }
    return "text-gray-600 dark:text-gray-400";
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) {
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    } else if (change < 0) {
      return (
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return null;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Analytics Preview
        </h2>
        <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
          View Full Report
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(analyticsData.pageViews.current)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Page Views</div>
          <div className={`flex items-center justify-center space-x-1 text-xs ${getChangeColor(analyticsData.pageViews.change)}`}>
            {getChangeIcon(analyticsData.pageViews.change)}
            <span>{Math.abs(analyticsData.pageViews.change)}%</span>
          </div>
        </div>
        <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(analyticsData.uniqueVisitors.current)}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Unique Visitors</div>
          <div className={`flex items-center justify-center space-x-1 text-xs ${getChangeColor(analyticsData.uniqueVisitors.change)}`}>
            {getChangeIcon(analyticsData.uniqueVisitors.change)}
            <span>{Math.abs(analyticsData.uniqueVisitors.change)}%</span>
          </div>
        </div>
      </div>

      {/* Top Performing Posts */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Top Performing Posts
        </h3>
        <div className="space-y-3">
          {topPosts.map((post, index) => (
            <div
              key={post.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-300 text-xs font-medium">
                  {index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {post.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatNumber(post.views)} views
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {post.engagement}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Traffic Sources Preview */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Traffic Sources
        </h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Organic Search</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">45%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Direct</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">32%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Social Media</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">18%</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-600 dark:text-gray-400">Email</span>
            <span className="text-xs font-medium text-gray-900 dark:text-white">5%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPreview;
