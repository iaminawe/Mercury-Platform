'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Rocket, 
  CheckCircle, 
  Circle,
  Code,
  Key,
  Zap,
  BookOpen,
  PlayCircle,
  Download,
  ExternalLink,
  Clock,
  Users,
  Star,
  ArrowRight,
  Copy
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface OnboardingStep {
  id: string
  title: string
  description: string
  icon: any
  completed: boolean
  estimatedTime: string
  type: 'action' | 'tutorial' | 'resource'
}

export default function OnboardingPage() {
  const { toast } = useToast()
  const [currentStep, setCurrentStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())

  const onboardingSteps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Mercury',
      description: 'Get familiar with the Mercury platform and developer portal',
      icon: Rocket,
      completed: false,
      estimatedTime: '2 min',
      type: 'tutorial'
    },
    {
      id: 'api-key',
      title: 'Generate Your First API Key',
      description: 'Create an API key to authenticate your requests',
      icon: Key,
      completed: false,
      estimatedTime: '3 min',
      type: 'action'
    },
    {
      id: 'first-request',
      title: 'Make Your First API Call',
      description: 'Test the API with a simple request to get products',
      icon: Code,
      completed: false,
      estimatedTime: '5 min',
      type: 'tutorial'
    },
    {
      id: 'sdk-setup',
      title: 'Install SDK',
      description: 'Set up the Mercury SDK in your preferred language',
      icon: Download,
      completed: false,
      estimatedTime: '4 min',
      type: 'action'
    },
    {
      id: 'explore-features',
      title: 'Explore AI Features',
      description: 'Try out personalization and recommendation APIs',
      icon: Zap,
      completed: false,
      estimatedTime: '10 min',
      type: 'tutorial'
    },
    {
      id: 'build-extension',
      title: 'Build Your First Extension',
      description: 'Create a simple extension using our framework',
      icon: PlayCircle,
      completed: false,
      estimatedTime: '20 min',
      type: 'tutorial'
    }
  ]

  const tutorials = [
    {
      id: 'quickstart',
      title: 'Mercury Quickstart',
      description: 'Complete guide to getting started with Mercury APIs',
      duration: '15 min',
      difficulty: 'Beginner',
      rating: 4.9,
      completions: 2847
    },
    {
      id: 'ai-recommendations',
      title: 'Building AI Recommendations',
      description: 'Learn how to implement personalized product recommendations',
      duration: '25 min',
      difficulty: 'Intermediate',
      rating: 4.8,
      completions: 1423
    },
    {
      id: 'extension-development',
      title: 'Extension Development',
      description: 'Complete course on building and publishing extensions',
      duration: '45 min',
      difficulty: 'Advanced',
      rating: 4.7,
      completions: 892
    }
  ]

  const toggleStepCompletion = (stepId: string) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId)
    } else {
      newCompleted.add(stepId)
    }
    setCompletedSteps(newCompleted)
    
    toast({
      title: newCompleted.has(stepId) ? "Step completed!" : "Step unchecked",
      description: newCompleted.has(stepId) ? "Great progress! Keep going." : "Step marked as incomplete."
    })
  }

  const progress = (completedSteps.size / onboardingSteps.length) * 100

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text)
    toast({
      title: "Copied to clipboard",
      description: "Code has been copied to your clipboard."
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Welcome to Mercury Development</h1>
            <p className="text-blue-100 text-lg mb-4">
              Let's get you started building amazing e-commerce experiences
            </p>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Circle className="w-4 h-4 fill-current" />
                <span>Interactive tutorials</span>
              </div>
              <div className="flex items-center space-x-2">
                <Circle className="w-4 h-4 fill-current" />
                <span>Hands-on coding</span>
              </div>
              <div className="flex items-center space-x-2">
                <Circle className="w-4 h-4 fill-current" />
                <span>Real examples</span>
              </div>
            </div>
          </div>
          <div className="hidden lg:block">
            <div className="w-48 h-32 bg-white/10 rounded-lg flex items-center justify-center">
              <Rocket className="w-16 h-16 text-white/60" />
            </div>
          </div>
        </div>
      </div>

      {/* Progress Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold">Your Progress</h3>
            <p className="text-muted-foreground">
              {completedSteps.size} of {onboardingSteps.length} steps completed
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-blue-600">{Math.round(progress)}%</p>
            <p className="text-sm text-muted-foreground">Complete</p>
          </div>
        </div>
        <Progress value={progress} className="h-2" />
      </Card>

      {/* Onboarding Steps */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Getting Started Checklist</h3>
          {onboardingSteps.map((step, index) => (
            <Card key={step.id} className={`p-4 cursor-pointer transition-all ${
              completedSteps.has(step.id) ? 'bg-green-50 border-green-200' : 'hover:shadow-md'
            }`}>
              <div className="flex items-start space-x-4">
                <div className="mt-1">
                  <Checkbox
                    checked={completedSteps.has(step.id)}
                    onCheckedChange={() => toggleStepCompletion(step.id)}
                  />
                </div>
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <step.icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className={`font-semibold ${completedSteps.has(step.id) ? 'line-through text-muted-foreground' : ''}`}>
                      {step.title}
                    </h4>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="text-xs">
                        <Clock className="w-3 h-3 mr-1" />
                        {step.estimatedTime}
                      </Badge>
                      <Badge variant={step.type === 'action' ? 'default' : step.type === 'tutorial' ? 'secondary' : 'outline'}>
                        {step.type}
                      </Badge>
                    </div>
                  </div>
                  <p className={`text-sm ${completedSteps.has(step.id) ? 'line-through text-muted-foreground' : 'text-muted-foreground'}`}>
                    {step.description}
                  </p>
                  {!completedSteps.has(step.id) && (
                    <Button variant="outline" size="sm" className="mt-3">
                      {step.type === 'action' ? 'Take Action' : 'Start Tutorial'}
                      <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Start Code */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Quick Start Code</h3>
          
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">1. Install SDK</h4>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard('npm install @mercury/sdk')}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <code className="text-green-400 text-sm">npm install @mercury/sdk</code>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">2. Initialize Client</h4>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`import { Mercury } from '@mercury/sdk'

const mercury = new Mercury({
  apiKey: 'your-api-key'
})`)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{`import { Mercury } from '@mercury/sdk'

const mercury = new Mercury({
  apiKey: 'your-api-key'
})`}</code>
              </pre>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold">3. Make Your First Request</h4>
              <Button variant="outline" size="sm" onClick={() => copyToClipboard(`const products = await mercury.products.list()
console.log(products)`)}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <div className="bg-gray-900 rounded-lg p-3">
              <pre className="text-sm text-gray-100">
                <code>{`const products = await mercury.products.list()
console.log(products)`}</code>
              </pre>
            </div>
          </Card>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start space-x-3">
              <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-900 mb-2">Pro Tip</h4>
                <p className="text-sm text-blue-800">
                  Use the interactive playground in the documentation to test API calls before implementing them in your code.
                </p>
                <Button variant="outline" size="sm" className="mt-2 border-blue-300 text-blue-700">
                  Try Playground
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Tutorials Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Interactive Tutorials</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tutorials.map((tutorial) => (
            <div key={tutorial.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant={
                    tutorial.difficulty === 'Beginner' ? 'default' :
                    tutorial.difficulty === 'Intermediate' ? 'secondary' : 'outline'
                  }>
                    {tutorial.difficulty}
                  </Badge>
                  <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{tutorial.duration}</span>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">{tutorial.title}</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    {tutorial.description}
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center space-x-2">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span>{tutorial.rating}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Users className="w-3 h-3" />
                    <span>{tutorial.completions.toLocaleString()} completed</span>
                  </div>
                </div>

                <Button className="w-full" size="sm">
                  <PlayCircle className="w-4 h-4 mr-2" />
                  Start Tutorial
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Resources */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Additional Resources</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
            <BookOpen className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">Documentation</h4>
            <p className="text-xs text-muted-foreground">Complete API reference</p>
          </div>
          
          <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
            <Users className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">Community</h4>
            <p className="text-xs text-muted-foreground">Join Discord community</p>
          </div>
          
          <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
            <Code className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">Examples</h4>
            <p className="text-xs text-muted-foreground">Sample projects & code</p>
          </div>
          
          <div className="text-center p-4 border rounded-lg hover:shadow-md transition-shadow cursor-pointer">
            <ExternalLink className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <h4 className="font-semibold mb-1">Support</h4>
            <p className="text-xs text-muted-foreground">Get help from our team</p>
          </div>
        </div>
      </Card>
    </div>
  )
}