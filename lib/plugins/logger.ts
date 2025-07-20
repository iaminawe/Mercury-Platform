/**
 * Plugin Logger
 * Specialized logging for plugin system
 */

import { writeFile, appendFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { PluginLogger } from './types';

export function createPluginLogger(pluginId: string): PluginLogger {
  return new PluginLoggerImpl(pluginId);
}

class PluginLoggerImpl implements PluginLogger {
  private pluginId: string;
  private logDir: string;
  private logFile: string;
  private errorFile: string;
  private buffer: LogEntry[] = [];
  private bufferSize = 100;
  private flushInterval: NodeJS.Timeout;

  constructor(pluginId: string) {
    this.pluginId = pluginId;
    this.logDir = join(process.cwd(), '.mercury', 'logs', 'plugins', pluginId);
    this.logFile = join(this.logDir, 'plugin.log');
    this.errorFile = join(this.logDir, 'error.log');
    
    this.initializeLogger();
    
    // Flush buffer every 5 seconds
    this.flushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);
  }

  debug(message: string, meta?: any): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: any): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: any): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: any): void {
    this.log('error', message, meta);
    
    // Also log to error file
    this.logToErrorFile(message, meta);
  }

  /**
   * Log with level
   */
  private log(level: LogLevel, message: string, meta?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      pluginId: this.pluginId,
      message,
      meta: meta ? this.sanitizeMeta(meta) : undefined
    };

    // Add to buffer
    this.buffer.push(entry);

    // Console output with plugin prefix
    const formattedMessage = this.formatMessage(entry);
    
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Initialize logger directories
   */
  private async initializeLogger(): Promise<void> {
    try {
      await this.ensureDirectory(this.logDir);
    } catch (error) {
      console.error(`Failed to initialize logger for plugin ${this.pluginId}:`, error);
    }
  }

  /**
   * Format log message for console
   */
  private formatMessage(entry: LogEntry): string {
    const timestamp = entry.timestamp.toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const plugin = `[Plugin:${entry.pluginId}]`;
    
    let formatted = `${timestamp} ${level} ${plugin} ${entry.message}`;
    
    if (entry.meta) {
      formatted += ` ${this.stringifyMeta(entry.meta)}`;
    }
    
    return formatted;
  }

  /**
   * Format log entry for file
   */
  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      pluginId: entry.pluginId,
      message: entry.message,
      meta: entry.meta
    }) + '\n';
  }

  /**
   * Sanitize metadata to prevent sensitive data leaks
   */
  private sanitizeMeta(meta: any): any {
    if (typeof meta !== 'object' || meta === null) {
      return meta;
    }

    const sanitized = { ...meta };
    
    // Remove sensitive fields
    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'apikey', 'api_key',
      'authorization', 'auth', 'credential', 'private'
    ];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Recursively sanitize nested objects
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMeta(value);
      }
    }

    return sanitized;
  }

  /**
   * Stringify metadata for display
   */
  private stringifyMeta(meta: any): string {
    try {
      return JSON.stringify(meta, null, 0);
    } catch (error) {
      return '[Unable to stringify meta]';
    }
  }

  /**
   * Flush buffer to log files
   */
  private async flushBuffer(): Promise<void> {
    if (this.buffer.length === 0) {
      return;
    }

    try {
      const entries = this.buffer.splice(0); // Clear buffer
      const logContent = entries.map(entry => this.formatLogEntry(entry)).join('');
      
      await appendFile(this.logFile, logContent);
    } catch (error) {
      console.error(`Failed to flush log buffer for plugin ${this.pluginId}:`, error);
    }
  }

  /**
   * Log to error file
   */
  private async logToErrorFile(message: string, meta?: any): Promise<void> {
    try {
      const entry: LogEntry = {
        timestamp: new Date(),
        level: 'error',
        pluginId: this.pluginId,
        message,
        meta: meta ? this.sanitizeMeta(meta) : undefined
      };

      const content = this.formatLogEntry(entry);
      await appendFile(this.errorFile, content);
    } catch (error) {
      console.error(`Failed to log error for plugin ${this.pluginId}:`, error);
    }
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await stat(dirPath);
    } catch {
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * Cleanup logger
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Final flush
    this.flushBuffer();
  }
}

/**
 * Plugin Log Aggregator
 * Collects and analyzes logs from all plugins
 */
export class PluginLogAggregator {
  private logDir: string;

  constructor() {
    this.logDir = join(process.cwd(), '.mercury', 'logs', 'plugins');
  }

  /**
   * Get logs for a specific plugin
   */
  async getPluginLogs(
    pluginId: string,
    options: {
      level?: LogLevel;
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<LogEntry[]> {
    try {
      const pluginLogFile = join(this.logDir, pluginId, 'plugin.log');
      const { readFile } = await import('fs/promises');
      const content = await readFile(pluginLogFile, 'utf-8');
      
      const lines = content.trim().split('\n').filter(line => line);
      const entries: LogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entry.timestamp = new Date(entry.timestamp);
          
          // Apply filters
          if (options.level && entry.level !== options.level) {
            continue;
          }
          
          if (options.since && entry.timestamp < options.since) {
            continue;
          }
          
          entries.push(entry);
        } catch (error) {
          // Skip invalid log entries
        }
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      if (options.limit) {
        return entries.slice(0, options.limit);
      }

      return entries;
    } catch (error) {
      console.error(`Failed to get logs for plugin ${pluginId}:`, error);
      return [];
    }
  }

  /**
   * Get error logs for a specific plugin
   */
  async getPluginErrorLogs(pluginId: string, limit: number = 100): Promise<LogEntry[]> {
    try {
      const errorLogFile = join(this.logDir, pluginId, 'error.log');
      const { readFile } = await import('fs/promises');
      const content = await readFile(errorLogFile, 'utf-8');
      
      const lines = content.trim().split('\n').filter(line => line);
      const entries: LogEntry[] = [];

      for (const line of lines) {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entry.timestamp = new Date(entry.timestamp);
          entries.push(entry);
        } catch (error) {
          // Skip invalid log entries
        }
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      return entries.slice(0, limit);
    } catch (error) {
      return []; // No error log file exists yet
    }
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(timeframe: { start: Date; end: Date }): Promise<LogStatistics> {
    const stats: LogStatistics = {
      totalLogs: 0,
      logsByLevel: { debug: 0, info: 0, warn: 0, error: 0 },
      logsByPlugin: {},
      errorRate: 0,
      timeframe
    };

    try {
      const { readdir } = await import('fs/promises');
      const pluginDirs = await readdir(this.logDir, { withFileTypes: true });

      for (const dir of pluginDirs) {
        if (dir.isDirectory()) {
          const pluginLogs = await this.getPluginLogs(dir.name, {
            since: timeframe.start
          });

          const pluginStats = {
            total: 0,
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
          };

          for (const log of pluginLogs) {
            if (log.timestamp >= timeframe.start && log.timestamp <= timeframe.end) {
              stats.totalLogs++;
              stats.logsByLevel[log.level]++;
              pluginStats.total++;
              pluginStats[log.level]++;
            }
          }

          if (pluginStats.total > 0) {
            stats.logsByPlugin[dir.name] = pluginStats;
          }
        }
      }

      // Calculate error rate
      if (stats.totalLogs > 0) {
        stats.errorRate = (stats.logsByLevel.error / stats.totalLogs) * 100;
      }

    } catch (error) {
      console.error('Failed to get log statistics:', error);
    }

    return stats;
  }

  /**
   * Search logs across all plugins
   */
  async searchLogs(
    query: string,
    options: {
      plugins?: string[];
      level?: LogLevel;
      limit?: number;
      since?: Date;
    } = {}
  ): Promise<LogEntry[]> {
    const results: LogEntry[] = [];
    const queryLower = query.toLowerCase();

    try {
      const { readdir } = await import('fs/promises');
      const pluginDirs = await readdir(this.logDir, { withFileTypes: true });

      for (const dir of pluginDirs) {
        if (dir.isDirectory()) {
          // Skip if not in plugin filter
          if (options.plugins && !options.plugins.includes(dir.name)) {
            continue;
          }

          const pluginLogs = await this.getPluginLogs(dir.name, {
            level: options.level,
            since: options.since
          });

          for (const log of pluginLogs) {
            const messageMatch = log.message.toLowerCase().includes(queryLower);
            const metaMatch = log.meta && 
              JSON.stringify(log.meta).toLowerCase().includes(queryLower);

            if (messageMatch || metaMatch) {
              results.push(log);
            }
          }
        }
      }

      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply limit
      if (options.limit) {
        return results.slice(0, options.limit);
      }

      return results;
    } catch (error) {
      console.error('Failed to search logs:', error);
      return [];
    }
  }
}

// Type definitions

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  pluginId: string;
  message: string;
  meta?: any;
}

interface LogStatistics {
  totalLogs: number;
  logsByLevel: Record<LogLevel, number>;
  logsByPlugin: Record<string, {
    total: number;
    debug: number;
    info: number;
    warn: number;
    error: number;
  }>;
  errorRate: number;
  timeframe: { start: Date; end: Date };
}