import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function PlayerDetailPage() {
  const { playerId } = useParams<{ playerId: string }>();

  return (
    <div className="min-h-screen p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-6xl mx-auto"
      >
        <h1 className="text-4xl font-bold mb-8">Player Details: {playerId}</h1>
        
        <div className="glass p-8 rounded-xl">
          <p className="text-gray-300">
            Player details, hero summary, coaching tips, and insights go here.
          </p>
          <p className="text-sm text-gray-400 mt-4">
            This is a placeholder. Implement player profile and AI insights display.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
