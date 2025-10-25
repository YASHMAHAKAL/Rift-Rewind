import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { SparklesIcon, ChartBarIcon, TrophyIcon } from '@heroicons/react/24/outline';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl"
        >
          {/* Logo/Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="inline-block mb-6"
          >
            <div className="glass px-6 py-3 rounded-full">
              <span className="text-sm font-semibold text-primary-400">
                Powered by AWS + Riot Games
              </span>
            </div>
          </motion.div>

          {/* Hero Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
          >
            Rift Rewind
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-2xl md:text-3xl text-gray-300 mb-4"
          >
            Your Season, Your Story
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto"
          >
            AI-powered insights and coaching from your League of Legends journey.
            Discover your strengths, unlock hidden gems, and celebrate your year on the Rift.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <button
              onClick={() => navigate('/dashboard')}
              className="btn-primary text-lg px-8 py-4 shadow-lg shadow-primary-500/50 hover:shadow-primary-500/70 transition-shadow"
            >
              Open Your Yearbook
            </button>
            <button
              onClick={() => navigate('/player/demo')}
              className="btn-secondary text-lg px-8 py-4"
            >
              Try Demo
            </button>
          </motion.div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            <FeatureCard
              icon={<SparklesIcon className="w-8 h-8" />}
              title="AI-Powered Insights"
              description="Personalized coaching tips generated from your match history"
            />
            <FeatureCard
              icon={<ChartBarIcon className="w-8 h-8" />}
              title="Interactive Timeline"
              description="Explore your season with beautiful visualizations"
            />
            <FeatureCard
              icon={<TrophyIcon className="w-8 h-8" />}
              title="Share Your Story"
              description="Generate shareable cards for social media"
            />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      className="glass p-6 rounded-xl"
    >
      <div className="text-primary-400 mb-3">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </motion.div>
  );
}
