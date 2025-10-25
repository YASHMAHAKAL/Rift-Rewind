import { motion } from 'framer-motion';

export default function TimelinePage() {
  return (
    <div className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8">Interactive Timeline</h1>
        
        <div className="glass p-8 rounded-xl">
          <p className="text-gray-300">
            Timeline visualization goes here - use D3/Visx to render match history.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            This is a placeholder. Implement interactive timeline component.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
