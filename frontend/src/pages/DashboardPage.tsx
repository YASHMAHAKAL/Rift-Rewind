import { motion } from 'framer-motion';

export default function DashboardPage() {
  return (
    <div className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>
        
        <div className="glass p-8 rounded-xl">
          <p className="text-gray-300">
            Dashboard page - Connect to Riot API and fetch player data here.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            This is a placeholder. Implement player search and data fetching.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
