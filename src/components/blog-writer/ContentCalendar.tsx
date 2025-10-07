import React from "react";

const ContentCalendar = () => {
  const calendarData = [
    {
      date: "2024-01-15",
      posts: [
        {
          id: 1,
          title: "Content Marketing Trends 2024",
          status: "published",
          time: "09:00",
          author: "Sarah",
        },
      ],
    },
    {
      date: "2024-01-16",
      posts: [
        {
          id: 2,
          title: "SEO Best Practices Guide",
          status: "scheduled",
          time: "14:00",
          author: "Mike",
        },
        {
          id: 3,
          title: "Social Media Strategy Tips",
          status: "scheduled",
          time: "16:00",
          author: "Emily",
        },
      ],
    },
    {
      date: "2024-01-17",
      posts: [
        {
          id: 4,
          title: "AI Writing Tools Review",
          status: "draft",
          time: "10:00",
          author: "David",
        },
      ],
    },
    {
      date: "2024-01-18",
      posts: [],
    },
    {
      date: "2024-01-19",
      posts: [
        {
          id: 5,
          title: "Email Marketing Automation",
          status: "scheduled",
          time: "11:00",
          author: "Sarah",
        },
      ],
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300 dark:border-green-700";
      case "scheduled":
        return "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-700";
      case "draft":
        return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900 dark:text-yellow-300 dark:border-yellow-700";
      case "in_review":
        return "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:border-purple-700";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Content Calendar
        </h2>
        <div className="flex items-center space-x-2">
          <button className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
            Month View
          </button>
          <button className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 font-medium">
            Week View
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {calendarData.map((day, index) => (
          <div
            key={index}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(day.date)}
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {day.posts.length} {day.posts.length === 1 ? "post" : "posts"}
              </span>
            </div>

            {day.posts.length > 0 ? (
              <div className="space-y-2">
                {day.posts.map((post) => (
                  <div
                    key={post.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getStatusColor(post.status)}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {post.title}
                      </p>
                      <p className="text-xs opacity-75">
                        {post.time} • {post.author}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {post.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <svg
                  className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  No posts scheduled
                </p>
                <button className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
                  Schedule a post
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Calendar Legend */}
      <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
          Legend
        </h4>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-100 border border-green-200 rounded"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Published</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-100 border border-blue-200 rounded"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Scheduled</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-100 border border-yellow-200 rounded"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">Draft</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-purple-100 border border-purple-200 rounded"></div>
            <span className="text-xs text-gray-600 dark:text-gray-400">In Review</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContentCalendar;
