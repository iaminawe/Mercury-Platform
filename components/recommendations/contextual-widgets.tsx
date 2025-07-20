'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from 'next-auth/react';
import { 
  ShoppingCart, Eye, Clock, MapPin, Smartphone, 
  Zap, Target, TrendingUp, Calendar, Sun, Moon,
  Coffee, Briefcase, Home, Car, Users, Heart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Image from 'next/image';
import { formatPrice } from '@/lib/utils/format';
import { cn } from '@/lib/utils';

interface ContextualWidgetProps {
  context: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 'weekday' | 'weekend';
    weather?: 'sunny' | 'rainy' | 'cold' | 'hot';
    location?: string;
    device: 'mobile' | 'tablet' | 'desktop';
    currentPage: string;
    userActivity: 'browsing' | 'searching' | 'purchasing' | 'comparing';
    sessionDuration: number;
    cartValue: number;
    isFirstVisit: boolean;
    isReturningCustomer: boolean;
  };
  className?: string;
}

interface ContextualRecommendation {
  id: string;
  name: string;
  price: number;
  image: string;
  contextReason: string;
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  timeLimit?: number;
}

export function ContextualWidgets({ context, className }: ContextualWidgetProps) {
  const { data: session } = useSession();
  const [recommendations, setRecommendations] = useState<ContextualRecommendation[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    loadContextualRecommendations();
    setIsVisible(true);
  }, [context]);

  const loadContextualRecommendations = async () => {
    // Generate contextual recommendations based on current context
    const contextualRecs = generateContextualRecommendations(context);
    setRecommendations(contextualRecs);
  };

  const widgets = [
    <TimeBasedWidget key="time" context={context} recommendations={recommendations} />,
    <WeatherWidget key="weather" context={context} recommendations={recommendations} />,
    <DeviceOptimizedWidget key="device" context={context} recommendations={recommendations} />,
    <BehaviorWidget key="behavior" context={context} recommendations={recommendations} />,
    <LocationWidget key="location" context={context} recommendations={recommendations} />,
    <SessionWidget key="session" context={context} recommendations={recommendations} />
  ].filter(Boolean);

  return (
    <div className={cn('space-y-4', className)}>
      <AnimatePresence>
        {isVisible && widgets.map((widget, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ delay: index * 0.1 }}
          >
            {widget}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function TimeBasedWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  const timeRecommendations = recommendations.filter(r => 
    r.contextReason.includes('time') || r.contextReason.includes(context.timeOfDay)
  ).slice(0, 3);

  if (timeRecommendations.length === 0) return null;

  const getTimeIcon = () => {
    switch (context.timeOfDay) {
      case 'morning': return <Sun className="w-5 h-5 text-yellow-500" />;
      case 'afternoon': return <Sun className="w-5 h-5 text-orange-500" />;
      case 'evening': return <Moon className="w-5 h-5 text-blue-500" />;
      case 'night': return <Moon className="w-5 h-5 text-indigo-500" />;
    }
  };

  const getTimeMessage = () => {
    switch (context.timeOfDay) {
      case 'morning': return 'Good Morning! Start your day right';
      case 'afternoon': return 'Afternoon Picks for You';
      case 'evening': return 'Evening Essentials';
      case 'night': return 'Late Night Finds';
    }
  };

  return (
    <Card className="overflow-hidden bg-gradient-to-r from-blue-50 to-purple-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getTimeIcon()}
          {getTimeMessage()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {timeRecommendations.map((rec) => (
            <div key={rec.id} className="text-center">
              <div className="relative aspect-square mb-2 rounded-lg overflow-hidden bg-white">
                <Image
                  src={rec.image}
                  alt={rec.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute top-1 right-1">
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(rec.confidence * 100)}%
                  </Badge>
                </div>
              </div>
              <h4 className="text-sm font-medium line-clamp-1">{rec.name}</h4>
              <p className="text-lg font-bold text-primary">{formatPrice(rec.price)}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{rec.contextReason}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WeatherWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  if (!context.weather) return null;

  const weatherRecommendations = recommendations.filter(r => 
    r.contextReason.includes('weather') || r.contextReason.includes(context.weather!)
  ).slice(0, 2);

  if (weatherRecommendations.length === 0) return null;

  const getWeatherGradient = () => {
    switch (context.weather) {
      case 'sunny': return 'from-yellow-100 to-orange-100';
      case 'rainy': return 'from-blue-100 to-slate-100';
      case 'cold': return 'from-blue-100 to-indigo-100';
      case 'hot': return 'from-red-100 to-orange-100';
      default: return 'from-gray-100 to-gray-100';
    }
  };

  const getWeatherMessage = () => {
    switch (context.weather) {
      case 'sunny': return '☀️ Perfect for outdoor activities';
      case 'rainy': return '🌧️ Stay dry and comfortable';
      case 'cold': return '❄️ Keep warm essentials';
      case 'hot': return '🔥 Beat the heat';
      default: return '🌤️ Weather-appropriate picks';
    }
  };

  return (
    <Card className={cn('overflow-hidden bg-gradient-to-r', getWeatherGradient())}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5" />
          {getWeatherMessage()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {weatherRecommendations.map((rec) => (
            <div key={rec.id} className="flex-1">
              <div className="relative aspect-[4/3] mb-2 rounded-lg overflow-hidden bg-white">
                <Image
                  src={rec.image}
                  alt={rec.name}
                  fill
                  className="object-cover"
                />
                {rec.urgency === 'high' && (
                  <div className="absolute top-2 left-2">
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      Urgent
                    </Badge>
                  </div>
                )}
              </div>
              <h4 className="text-sm font-medium line-clamp-1">{rec.name}</h4>
              <p className="text-lg font-bold text-primary">{formatPrice(rec.price)}</p>
              <p className="text-xs text-muted-foreground">{rec.contextReason}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DeviceOptimizedWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  const deviceRecommendations = recommendations.filter(r => 
    r.contextReason.includes('mobile') || r.contextReason.includes('device')
  ).slice(0, 4);

  if (context.device !== 'mobile' || deviceRecommendations.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-green-50 to-emerald-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Smartphone className="w-5 h-5 text-green-600" />
          Mobile Shopping Optimized
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {deviceRecommendations.map((rec) => (
            <div key={rec.id} className="flex gap-3 p-3 bg-white rounded-lg">
              <div className="relative w-16 h-16 rounded-md overflow-hidden bg-gray-100">
                <Image
                  src={rec.image}
                  alt={rec.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-1">{rec.name}</h4>
                <p className="text-sm font-bold text-primary">{formatPrice(rec.price)}</p>
                <Button size="sm" variant="outline" className="mt-1 h-6 text-xs">
                  Quick Add
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function BehaviorWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  const behaviorRecommendations = recommendations.filter(r => 
    r.contextReason.includes(context.userActivity)
  ).slice(0, 3);

  if (behaviorRecommendations.length === 0) return null;

  const getBehaviorIcon = () => {
    switch (context.userActivity) {
      case 'browsing': return <Eye className="w-5 h-5 text-blue-600" />;
      case 'searching': return <Target className="w-5 h-5 text-purple-600" />;
      case 'purchasing': return <ShoppingCart className="w-5 h-5 text-green-600" />;
      case 'comparing': return <TrendingUp className="w-5 h-5 text-orange-600" />;
    }
  };

  const getBehaviorMessage = () => {
    switch (context.userActivity) {
      case 'browsing': return 'Based on what you\'re viewing';
      case 'searching': return 'Related to your search';
      case 'purchasing': return 'Complete your purchase';
      case 'comparing': return 'Help you decide';
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-pink-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          {getBehaviorIcon()}
          {getBehaviorMessage()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {behaviorRecommendations.map((rec, index) => (
            <div key={rec.id} className="flex items-center gap-3 p-2 bg-white rounded-lg">
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-100">
                <Image
                  src={rec.image}
                  alt={rec.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium line-clamp-1">{rec.name}</h4>
                <p className="text-xs text-muted-foreground">{rec.contextReason}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-primary">{formatPrice(rec.price)}</p>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500"></div>
                  <span className="text-xs text-green-600">{Math.round(rec.confidence * 100)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LocationWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  if (!context.location) return null;

  const locationRecommendations = recommendations.filter(r => 
    r.contextReason.includes('location') || r.contextReason.includes('local')
  ).slice(0, 2);

  if (locationRecommendations.length === 0) return null;

  return (
    <Card className="bg-gradient-to-r from-cyan-50 to-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-cyan-600" />
          Popular in {context.location}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          {locationRecommendations.map((rec) => (
            <div key={rec.id} className="flex-1 text-center">
              <div className="relative aspect-square mb-2 rounded-lg overflow-hidden bg-white">
                <Image
                  src={rec.image}
                  alt={rec.name}
                  fill
                  className="object-cover"
                />
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="bg-black/70 text-white text-xs px-2 py-1 rounded">
                    Trending locally
                  </div>
                </div>
              </div>
              <h4 className="text-sm font-medium line-clamp-1">{rec.name}</h4>
              <p className="text-lg font-bold text-primary">{formatPrice(rec.price)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SessionWidget({ context, recommendations }: { 
  context: ContextualWidgetProps['context']; 
  recommendations: ContextualRecommendation[] 
}) {
  const sessionRecommendations = recommendations.filter(r => 
    r.contextReason.includes('session') || r.urgency === 'high'
  ).slice(0, 1);

  if (sessionRecommendations.length === 0) return null;

  const rec = sessionRecommendations[0];
  const sessionMinutes = Math.floor(context.sessionDuration / 60000);

  return (
    <Card className="bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-white">
            <Image
              src={rec.image}
              alt={rec.name}
              fill
              className="object-cover"
            />
            {rec.timeLimit && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="text-white text-xs text-center">
                  <Clock className="w-4 h-4 mx-auto mb-1" />
                  <div>{rec.timeLimit}m left</div>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-yellow-600" />
              <Badge variant="destructive" className="animate-pulse">Limited Time</Badge>
            </div>
            <h4 className="font-medium">{rec.name}</h4>
            <p className="text-2xl font-bold text-primary">{formatPrice(rec.price)}</p>
            <p className="text-sm text-muted-foreground">{rec.contextReason}</p>
            
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Session: {sessionMinutes}m</span>
                <span>Confidence: {Math.round(rec.confidence * 100)}%</span>
              </div>
              <Progress value={rec.confidence * 100} className="h-2" />
            </div>
          </div>
          
          <div className="text-center">
            <Button size="sm" className="mb-2">
              Add to Cart
            </Button>
            <Button size="sm" variant="outline">
              <Heart className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper function to generate contextual recommendations
function generateContextualRecommendations(context: ContextualWidgetProps['context']): ContextualRecommendation[] {
  const baseRecommendations = [
    {
      id: 'ctx_1',
      name: 'Smart Coffee Mug',
      price: 49.99,
      image: '/images/products/mug.jpg',
      contextReason: '',
      urgency: 'medium' as const,
      confidence: 0.85
    },
    {
      id: 'ctx_2', 
      name: 'Wireless Headphones',
      price: 129.99,
      image: '/images/products/headphones.jpg',
      contextReason: '',
      urgency: 'low' as const,
      confidence: 0.92
    },
    {
      id: 'ctx_3',
      name: 'Rain Jacket',
      price: 89.99,
      image: '/images/products/jacket.jpg',
      contextReason: '',
      urgency: 'high' as const,
      confidence: 0.78
    },
    {
      id: 'ctx_4',
      name: 'Desk Organizer',
      price: 34.99,
      image: '/images/products/organizer.jpg',
      contextReason: '',
      urgency: 'low' as const,
      confidence: 0.65
    },
    {
      id: 'ctx_5',
      name: 'Sunglasses',
      price: 79.99,
      image: '/images/products/sunglasses.jpg',
      contextReason: '',
      urgency: 'medium' as const,
      confidence: 0.73
    },
    {
      id: 'ctx_6',
      name: 'Portable Charger',
      price: 29.99,
      image: '/images/products/charger.jpg',
      contextReason: '',
      urgency: 'medium' as const,
      confidence: 0.88
    }
  ];

  return baseRecommendations.map(rec => {
    let contextReason = '';
    let confidence = rec.confidence;
    let urgency = rec.urgency;

    // Time-based context
    if (context.timeOfDay === 'morning' && rec.name.includes('Coffee')) {
      contextReason = 'Perfect for your morning coffee routine';
      confidence += 0.1;
      urgency = 'high';
    } else if (context.timeOfDay === 'evening' && rec.name.includes('Headphones')) {
      contextReason = 'Great for evening relaxation and music';
      confidence += 0.08;
    }

    // Weather-based context
    if (context.weather === 'rainy' && rec.name.includes('Rain')) {
      contextReason = 'Essential for today\'s rainy weather';
      confidence += 0.15;
      urgency = 'high';
    } else if (context.weather === 'sunny' && rec.name.includes('Sunglasses')) {
      contextReason = 'Protect your eyes from bright sunlight';
      confidence += 0.12;
      urgency = 'medium';
    }

    // Device-based context
    if (context.device === 'mobile' && rec.name.includes('Charger')) {
      contextReason = 'Keep your mobile device charged on the go';
      confidence += 0.1;
      urgency = 'medium';
    }

    // Behavior-based context
    if (context.userActivity === 'browsing' && rec.name.includes('Organizer')) {
      contextReason = 'Based on your browsing pattern, you might like this';
      confidence += 0.05;
    }

    // Session-based context
    if (context.sessionDuration > 600000) { // 10+ minutes
      contextReason = 'You\'ve been browsing for a while - special session offer';
      if (rec.id === 'ctx_1') {
        urgency = 'high';
        confidence += 0.1;
        return { ...rec, contextReason, confidence, urgency, timeLimit: 15 };
      }
    }

    // Default context reason if none matched
    if (!contextReason) {
      contextReason = 'Recommended based on your current context';
    }

    return {
      ...rec,
      contextReason,
      confidence: Math.min(confidence, 1),
      urgency
    };
  });
}