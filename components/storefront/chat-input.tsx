'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Mic, MicOff, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  theme?: 'light' | 'dark';
  maxLength?: number;
  onTyping?: (isTyping: boolean) => void;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = "Type your message...",
  theme = 'light',
  maxLength = 1000,
  onTyping
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      onTyping?.(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= maxLength) {
      setMessage(value);
      
      // Typing indicator
      if (onTyping) {
        onTyping(value.length > 0);
        
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        typingTimeoutRef.current = setTimeout(() => {
          onTyping(false);
        }, 1000);
      }
    }
  };

  // Voice recording functionality
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        // Here you would typically send the audio to a speech-to-text service
        handleVoiceTranscription(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleVoiceTranscription = async (audioBlob: Blob) => {
    // Implement speech-to-text API call here
    // For now, we'll show a placeholder
    setMessage(prev => prev + '[Voice message transcribed]');
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Quick emoji reactions
  const quickEmojis = ['👍', '❤️', '😊', '🎉', '🤔', '👋'];

  const insertEmoji = (emoji: string) => {
    setMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="relative">
      {/* Quick emoji picker */}
      {showEmojiPicker && (
        <div className={`absolute bottom-full left-0 mb-2 p-2 rounded-lg shadow-lg border ${
          theme === 'dark' ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'
        }`}>
          <div className="flex space-x-2">
            {quickEmojis.map((emoji) => (
              <Button
                key={emoji}
                variant="ghost"
                size="sm"
                onClick={() => insertEmoji(emoji)}
                className="w-8 h-8 p-0 text-lg hover:bg-gray-100"
              >
                {emoji}
              </Button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        {/* File attachment button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`p-2 ${disabled ? 'opacity-50' : ''}`}
          disabled={disabled}
          title="Attach file"
        >
          <Paperclip size={16} />
        </Button>

        {/* Main input area */}
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={disabled}
            className={`min-h-[40px] max-h-[120px] resize-none pr-12 ${
              theme === 'dark' 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-white border-gray-300'
            } ${disabled ? 'opacity-50' : ''}`}
            rows={1}
          />
          
          {/* Character count */}
          {message.length > maxLength * 0.8 && (
            <div className={`absolute bottom-2 right-12 text-xs ${
              message.length >= maxLength ? 'text-red-500' : 'text-gray-500'
            }`}>
              {message.length}/{maxLength}
            </div>
          )}

          {/* Emoji button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="absolute bottom-1 right-1 p-1 w-8 h-8"
            disabled={disabled}
          >
            <Smile size={16} />
          </Button>
        </div>

        {/* Voice recording button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
          className={`p-2 ${
            isRecording ? 'bg-red-100 text-red-600' : ''
          } ${disabled ? 'opacity-50' : ''}`}
          disabled={disabled}
          title={isRecording ? 'Release to stop recording' : 'Hold to record voice message'}
        >
          {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
        </Button>

        {/* Send button */}
        <Button
          type="submit"
          disabled={!message.trim() || disabled}
          className={`p-2 ${
            theme === 'dark' 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Send size={16} />
        </Button>
      </form>

      {/* Suggested quick replies */}
      {message.length === 0 && !disabled && (
        <div className="flex flex-wrap gap-1 mt-2">
          {['Yes', 'No', 'Thank you', 'I need help'].map((reply) => (
            <Button
              key={reply}
              variant="outline"
              size="sm"
              onClick={() => setMessage(reply)}
              className={`text-xs h-6 px-2 ${
                theme === 'dark' 
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700' 
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {reply}
            </Button>
          ))}
        </div>
      )}

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -top-12 left-0 right-0 flex items-center justify-center">
          <div className={`px-3 py-1 rounded-full text-sm flex items-center space-x-2 ${
            theme === 'dark' ? 'bg-red-800 text-red-200' : 'bg-red-100 text-red-800'
          }`}>
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Recording... Release to send</span>
          </div>
        </div>
      )}
    </div>
  );
}