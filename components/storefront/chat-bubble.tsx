'use client';

import React from 'react';
import { Copy, ThumbsUp, ThumbsDown, ExternalLink, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChatMessage } from './chat-widget';

interface ChatBubbleProps {
  message: ChatMessage;
  theme?: 'light' | 'dark';
  onProductClick?: (productId: string) => void;
  onFeedback?: (messageId: string, feedback: 'positive' | 'negative') => void;
}

export function ChatBubble({ 
  message, 
  theme = 'light', 
  onProductClick,
  onFeedback 
}: ChatBubbleProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  
  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content);
  };

  const handleFeedback = (type: 'positive' | 'negative') => {
    onFeedback?.(message.id, type);
  };

  const formatContent = (content: string) => {
    // Convert markdown-like formatting to JSX
    const parts = content.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`|\[.*?\]\(.*?\))/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code 
            key={index} 
            className={`px-1 py-0.5 rounded text-sm ${
              theme === 'dark' ? 'bg-gray-600' : 'bg-gray-100'
            }`}
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      
      // Handle links [text](url)
      const linkMatch = part.match(/\[(.*?)\]\((.*?)\)/);
      if (linkMatch) {
        return (
          <a
            key={index}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline inline-flex items-center gap-1"
          >
            {linkMatch[1]}
            <ExternalLink size={12} />
          </a>
        );
      }
      
      return part;
    });
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} w-full`}>
      <div className={`max-w-xs lg:max-w-md ${isUser ? 'order-2' : 'order-1'}`}>
        {/* Message bubble */}
        <div
          className={`rounded-lg px-4 py-3 shadow-sm ${
            isUser
              ? 'bg-blue-500 text-white rounded-br-none'
              : isSystem
              ? theme === 'dark' 
                ? 'bg-yellow-900 text-yellow-100 border border-yellow-700'
                : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
              : theme === 'dark'
              ? 'bg-gray-700 text-white rounded-bl-none'
              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
          }`}
        >
          {/* Error indicator */}
          {message.metadata?.error && (
            <div className="flex items-center gap-2 mb-2 text-red-400">
              <AlertCircle size={16} />
              <span className="text-sm">Error occurred</span>
            </div>
          )}

          {/* Escalation notice */}
          {message.metadata?.escalated && (
            <div className="mb-2">
              <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-200">
                Escalated to human agent
              </Badge>
            </div>
          )}

          {/* Intent and confidence (for debugging) */}
          {message.metadata?.intent && process.env.NODE_ENV === 'development' && (
            <div className="mb-2 text-xs opacity-75">
              Intent: {message.metadata.intent} 
              {message.metadata.confidence && ` (${Math.round(message.metadata.confidence * 100)}%)`}
            </div>
          )}

          {/* Message content */}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {formatContent(message.content)}
          </div>

          {/* Order information */}
          {message.metadata?.order_id && (
            <div className={`mt-3 p-2 rounded ${
              theme === 'dark' ? 'bg-gray-600' : 'bg-gray-50'
            }`}>
              <div className="text-xs font-medium">Order Reference</div>
              <div className="text-sm font-mono">{message.metadata.order_id}</div>
            </div>
          )}

          {/* Language indicator */}
          {message.metadata?.language && message.metadata.language !== 'en' && (
            <div className="mt-2">
              <Badge variant="secondary" className="text-xs">
                {message.metadata.language.toUpperCase()}
              </Badge>
            </div>
          )}
        </div>

        {/* Message actions */}
        {!isUser && !isSystem && (
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyText}
                className="h-6 px-2 text-xs opacity-60 hover:opacity-100"
              >
                <Copy size={12} />
              </Button>
              
              {onFeedback && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback('positive')}
                    className="h-6 px-2 text-xs opacity-60 hover:opacity-100 hover:text-green-600"
                  >
                    <ThumbsUp size={12} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleFeedback('negative')}
                    className="h-6 px-2 text-xs opacity-60 hover:opacity-100 hover:text-red-600"
                  >
                    <ThumbsDown size={12} />
                  </Button>
                </>
              )}
            </div>

            <span className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}

        {/* User message timestamp */}
        {isUser && (
          <div className="flex justify-end mt-1">
            <span className={`text-xs ${
              theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
            }`}>
              {formatTimestamp(message.timestamp)}
            </span>
          </div>
        )}
      </div>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
        isUser 
          ? 'order-1 mr-2 bg-blue-500 text-white'
          : 'order-2 ml-2'
      }`}>
        {isUser ? (
          'You'
        ) : (
          <div className={`w-full h-full rounded-full flex items-center justify-center ${
            theme === 'dark' ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
          }`}>
            AI
          </div>
        )}
      </div>
    </div>
  );
}