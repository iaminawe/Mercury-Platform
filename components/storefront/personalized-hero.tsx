'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { personalizationEngine } from '@/lib/personalization/engine';
import { cn } from '@/lib/utils';

interface HeroSlide {
  id: string;
  title: string;
  subtitle: string;
  description?: string;
  image: string;
  cta: {
    text: string;
    href: string;
    variant?: 'default' | 'secondary' | 'outline';
  };
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  overlay?: {
    color: string;
    opacity: number;
  };
}

interface PersonalizedHeroProps {
  fallbackSlides?: HeroSlide[];
  className?: string;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showIndicators?: boolean;
  showNavigation?: boolean;
}

export function PersonalizedHero({
  fallbackSlides = defaultSlides,
  className,
  autoPlay = true,
  autoPlayInterval = 6000,
  showIndicators = true,
  showNavigation = true
}: PersonalizedHeroProps) {
  const { data: session } = useSession();
  const [slides, setSlides] = useState<HeroSlide[]>(fallbackSlides);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  // Fetch personalized content
  useEffect(() => {
    async function loadPersonalizedContent() {
      if (!session?.user?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const context = {
          userId: session.user.id,
          sessionId: session.id || 'anonymous',
          device: {
            type: getDeviceType(),
            browser: navigator.userAgent,
            os: navigator.platform
          },
          currentPath: window.location.pathname,
          timestamp: new Date()
        };

        const result = await personalizationEngine.personalize(context);
        
        if (result.personalizedContent.hero) {
          const heroData = result.personalizedContent.hero;
          
          // Transform personalized data into slides
          const personalizedSlides = heroData.slides || generatePersonalizedSlides(
            result.segments,
            result.recommendations,
            result.scoring
          );
          
          setSlides(personalizedSlides);
        }
      } catch (error) {
        console.error('Failed to load personalized hero:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPersonalizedContent();
  }, [session]);

  // Auto-play functionality
  useEffect(() => {
    if (!autoPlay || isPaused || slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, autoPlayInterval);

    return () => clearInterval(interval);
  }, [autoPlay, autoPlayInterval, isPaused, slides.length]);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  const goToPrevious = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const handleMouseEnter = () => {
    setIsPaused(true);
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
  };

  if (isLoading) {
    return (
      <div className={cn('relative w-full h-[600px] bg-gray-100 animate-pulse', className)}>
        <div className="absolute inset-0 flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-gray-400 animate-spin" />
        </div>
      </div>
    );
  }

  const currentSlideData = slides[currentSlide];

  return (
    <div
      className={cn('relative w-full overflow-hidden', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlideData.id}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="relative w-full h-[600px] md:h-[700px]"
        >
          {/* Background Image */}
          <div className="absolute inset-0">
            <Image
              src={currentSlideData.image}
              alt={currentSlideData.title}
              fill
              className="object-cover"
              priority={currentSlide === 0}
              quality={90}
            />
            
            {/* Overlay */}
            {currentSlideData.overlay && (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: currentSlideData.overlay.color,
                  opacity: currentSlideData.overlay.opacity
                }}
              />
            )}
          </div>

          {/* Content */}
          <div className="relative h-full flex items-center">
            <div className="container mx-auto px-4 md:px-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="max-w-2xl"
              >
                {/* Badge */}
                {currentSlideData.badge && (
                  <Badge
                    variant={currentSlideData.badge.variant}
                    className="mb-4 inline-flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {currentSlideData.badge.text}
                  </Badge>
                )}

                {/* Title */}
                <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
                  {currentSlideData.title}
                </h1>

                {/* Subtitle */}
                <p className="text-xl md:text-2xl text-white/90 mb-6">
                  {currentSlideData.subtitle}
                </p>

                {/* Description */}
                {currentSlideData.description && (
                  <p className="text-lg text-white/80 mb-8 max-w-xl">
                    {currentSlideData.description}
                  </p>
                )}

                {/* CTA Button */}
                <Link href={currentSlideData.cta.href}>
                  <Button
                    size="lg"
                    variant={currentSlideData.cta.variant || 'default'}
                    className="text-lg px-8 py-6"
                  >
                    {currentSlideData.cta.text}
                  </Button>
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Navigation Arrows */}
          {showNavigation && slides.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Indicators */}
          {showIndicators && slides.length > 1 && (
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToSlide(index)}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all duration-300',
                    index === currentSlide
                      ? 'w-8 bg-white'
                      : 'bg-white/50 hover:bg-white/70'
                  )}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Personalization Indicator */}
      {session?.user && (
        <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm">
          <Sparkles className="w-4 h-4" />
          <span>Personalized for you</span>
        </div>
      )}
    </div>
  );
}

// Helper function to get device type
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const width = window.innerWidth;
  if (width < 768) return 'mobile';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

// Generate personalized slides based on user data
function generatePersonalizedSlides(
  segments: string[],
  recommendations: any,
  scoring: any
): HeroSlide[] {
  const slides: HeroSlide[] = [];

  // High-value customer slide
  if (segments.includes('high-value')) {
    slides.push({
      id: 'vip-exclusive',
      title: 'VIP Exclusive Collection',
      subtitle: 'Curated just for our valued customers',
      description: 'Discover premium products handpicked for your refined taste',
      image: '/images/hero/vip-collection.jpg',
      cta: {
        text: 'Explore VIP Collection',
        href: '/collections/vip-exclusive'
      },
      badge: {
        text: 'VIP Access',
        variant: 'default'
      },
      overlay: {
        color: '#000000',
        opacity: 0.3
      }
    });
  }

  // New customer welcome
  if (segments.includes('new-customers')) {
    slides.push({
      id: 'welcome-offer',
      title: 'Welcome to Mercury',
      subtitle: 'Get 20% off your first order',
      description: 'Start your journey with exclusive savings on our bestsellers',
      image: '/images/hero/welcome.jpg',
      cta: {
        text: 'Shop Now & Save',
        href: '/collections/bestsellers?discount=WELCOME20'
      },
      badge: {
        text: 'Limited Time Offer',
        variant: 'destructive'
      },
      overlay: {
        color: '#1e40af',
        opacity: 0.4
      }
    });
  }

  // Category-based slide
  if (recommendations.categories.length > 0) {
    const topCategory = recommendations.categories[0];
    slides.push({
      id: `category-${topCategory}`,
      title: `Trending in ${capitalize(topCategory)}`,
      subtitle: 'Based on your interests',
      image: `/images/hero/${topCategory}.jpg`,
      cta: {
        text: `Shop ${capitalize(topCategory)}`,
        href: `/categories/${topCategory}`
      },
      overlay: {
        color: '#059669',
        opacity: 0.3
      }
    });
  }

  // Seasonal/default slide
  slides.push({
    id: 'seasonal',
    title: 'Summer Collection 2024',
    subtitle: 'Fresh styles for the season',
    image: '/images/hero/summer-2024.jpg',
    cta: {
      text: 'Discover Summer Styles',
      href: '/collections/summer-2024'
    },
    overlay: {
      color: '#ea580c',
      opacity: 0.2
    }
  });

  return slides;
}

// Default fallback slides
const defaultSlides: HeroSlide[] = [
  {
    id: 'default-1',
    title: 'New Arrivals',
    subtitle: 'Discover the latest trends',
    image: '/images/hero/new-arrivals.jpg',
    cta: {
      text: 'Shop New',
      href: '/collections/new-arrivals'
    },
    overlay: {
      color: '#000000',
      opacity: 0.3
    }
  },
  {
    id: 'default-2',
    title: 'Best Sellers',
    subtitle: 'Shop customer favorites',
    image: '/images/hero/bestsellers.jpg',
    cta: {
      text: 'Shop Bestsellers',
      href: '/collections/bestsellers'
    },
    overlay: {
      color: '#1e293b',
      opacity: 0.4
    }
  }
];

// Utility function
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}