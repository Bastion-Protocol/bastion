import React from 'react';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Bastion Protocol
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Decentralized lending circles with social verification
          </p>
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h2 className="text-lg font-semibold text-blue-900">
              🚀 Development Setup Complete
            </h2>
            <p className="text-blue-700 mt-2">
              Frontend is running successfully!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;