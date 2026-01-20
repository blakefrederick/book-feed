'use client'

import Link from 'next/link'

export default function DevPage() {
  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          🛠️ Developer Tools
        </h1>
        
        <div className="space-y-4">
          <Link
            href="/dev/validation"
            className="block bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-lg transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">📊 Data Validation Dashboard</h2>
            <p className="text-blue-100">
              Validate Firebase collections and assess ML readiness for recommendation engine
            </p>
          </Link>
          
          <Link
            href="/"
            className="block bg-gray-700 hover:bg-gray-600 text-white p-6 rounded-lg transition-colors"
          >
            <h2 className="text-xl font-semibold mb-2">📖 Back to Feed</h2>
            <p className="text-gray-300">
              Return to the main app to generate more engagement data
            </p>
          </Link>
        </div>

        <div className="mt-8 bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">How to Test:</h3>
          <ol className="text-gray-300 space-y-2">
            <li>1. Use the main app to scroll through passages</li>
            <li>2. Visit the validation dashboard to check data quality</li>
            <li>3. Look at browser console for detailed logs</li>
            <li>4. Repeat until ML-ready threshold is met</li>
          </ol>
        </div>
      </div>
    </div>
  )
}