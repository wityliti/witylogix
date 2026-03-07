import React, { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'support';
  text: string;
  timestamp: string;
}

interface LiveChatProps {
  onClose?: () => void;
}

const LiveChat: React.FC<LiveChatProps> = ({ onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'support',
      text: 'Hello! How can we help you track your order today?',
      timestamp: new Date(Date.now() - 2 * 60000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const quickActions = [
    { id: 'package', label: 'Where is my package?', icon: '📦' },
    { id: 'time', label: 'Change delivery time', icon: '⏰' },
    { id: 'driver', label: 'Contact driver', icon: '☎️' },
  ];

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleQuickAction = (action: string) => {
    const text = action;
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate support response
    setIsTyping(true);
    setTimeout(() => {
      const supportMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'support',
        text: getResponseForAction(action),
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages(prev => [...prev, supportMessage]);
      setIsTyping(false);
    }, 1500);
  };

  const getResponseForAction = (action: string): string => {
    if (action.includes('package')) {
      return 'Your package is currently out for delivery and should arrive within the next 2 hours. You can track it in real-time above!';
    }
    if (action.includes('delivery time')) {
      return 'To change your delivery time, please use the preferences section. You can select morning, afternoon, or evening.';
    }
    if (action.includes('driver')) {
      return 'You can contact the driver directly once they mark "Out for Delivery" in the timeline above.';
    }
    return 'Thanks for reaching out! Is there anything else I can help you with?';
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    // Simulate support response
    setIsTyping(true);
    setTimeout(() => {
      const supportMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'support',
        text: 'Thank you for your message! Our team will respond shortly.',
        timestamp: new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      setMessages(prev => [...prev, supportMessage]);
      setIsTyping(false);
    }, 1000);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Collapsed bubble
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        style={styles.bubble}
        title="Open chat"
      >
        <span style={styles.bubbleIcon}>💬</span>
      </button>
    );
  }

  // Expanded chat window
  return (
    <div style={styles.chatWindow}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.headerTitle}>Support Chat</h3>
        <div style={styles.headerControls}>
          <button
            onClick={() => setIsExpanded(false)}
            style={styles.headerButton}
            title="Minimize"
          >
            −
          </button>
          <button
            onClick={() => {
              setIsExpanded(false);
              onClose?.();
            }}
            style={styles.headerButton}
            title="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map(message => (
          <div
            key={message.id}
            style={{
              ...styles.messageWrapper,
              ...(message.sender === 'user'
                ? styles.messageWrapperUser
                : styles.messageWrapperSupport),
            }}
          >
            <div
              style={{
                ...styles.messageBubble,
                ...(message.sender === 'user'
                  ? styles.messageBubbleUser
                  : styles.messageBubbleSupport),
              }}
            >
              <p style={styles.messageText}>{message.text}</p>
              <span style={styles.messageTime}>{message.timestamp}</span>
            </div>
          </div>
        ))}

        {isTyping && (
          <div style={styles.messageWrapperSupport}>
            <div style={styles.messageBubbleSupport}>
              <div style={styles.typingIndicator}>
                <span style={styles.typingDot} />
                <span style={styles.typingDot} />
                <span style={styles.typingDot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions (shown if no user messages yet) */}
      {messages.length <= 1 && !isTyping && (
        <div style={styles.quickActionsContainer}>
          <p style={styles.quickActionsLabel}>Quick replies:</p>
          <div style={styles.quickActionsGrid}>
            {quickActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.label)}
                style={styles.quickActionButton}
              >
                <span style={styles.quickActionIcon}>{action.icon}</span>
                <span style={styles.quickActionText}>{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div style={styles.inputContainer}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your message..."
          style={styles.input}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputValue.trim()}
          style={{
            ...styles.sendButton,
            ...(inputValue.trim() ? {} : styles.sendButtonDisabled),
          }}
        >
          ➤
        </button>
      </div>

      {/* Footer */}
      <p style={styles.footer}>Average response time: 2 minutes</p>
    </div>
  );
};

const styles = {
  bubble: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    background: '#005bd3',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 16px rgba(0, 91, 211, 0.3)',
    zIndex: 999,
    transition: 'all 0.2s',
  } as React.CSSProperties,
  bubbleIcon: {
    fontSize: '24px',
  } as React.CSSProperties,
  chatWindow: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '360px',
    height: '600px',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 5px 40px rgba(0, 0, 0, 0.16)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999,
    overflow: 'hidden',
  } as React.CSSProperties,
  header: {
    background: '#005bd3',
    color: 'white',
    padding: '16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as React.CSSProperties,
  headerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    margin: '0',
  } as React.CSSProperties,
  headerControls: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,
  headerButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    width: '28px',
    height: '28px',
    borderRadius: '4px',
    fontSize: '16px',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  } as React.CSSProperties,
  messageWrapper: {
    display: 'flex',
    marginBottom: '4px',
  } as React.CSSProperties,
  messageWrapperUser: {
    justifyContent: 'flex-end',
  } as React.CSSProperties,
  messageWrapperSupport: {
    justifyContent: 'flex-start',
  } as React.CSSProperties,
  messageBubble: {
    maxWidth: '75%',
    padding: '10px 14px',
    borderRadius: '8px',
  } as React.CSSProperties,
  messageBubbleUser: {
    background: '#005bd3',
    color: 'white',
  } as React.CSSProperties,
  messageBubbleSupport: {
    background: '#f3f4f6',
    color: '#1a1a1a',
  } as React.CSSProperties,
  messageText: {
    margin: '0 0 6px 0',
    fontSize: '13px',
    lineHeight: '1.4',
  } as React.CSSProperties,
  messageTime: {
    fontSize: '11px',
    opacity: 0.6,
  } as React.CSSProperties,
  typingIndicator: {
    display: 'flex',
    gap: '4px',
    padding: '4px 0',
  } as React.CSSProperties,
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#999',
    animation: 'typing 1.4s infinite',
  } as React.CSSProperties,
  quickActionsContainer: {
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
  } as React.CSSProperties,
  quickActionsLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#999',
    margin: '0 0 8px 0',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  quickActionsGrid: {
    display: 'grid',
    gap: '6px',
  } as React.CSSProperties,
  quickActionButton: {
    padding: '8px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    background: '#f9fafb',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  quickActionIcon: {
    fontSize: '14px',
  } as React.CSSProperties,
  quickActionText: {
    textAlign: 'left',
    flex: 1,
  } as React.CSSProperties,
  inputContainer: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    borderTop: '1px solid #e5e7eb',
  } as React.CSSProperties,
  input: {
    flex: 1,
    padding: '10px 12px',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    fontSize: '13px',
    outline: 'none',
  } as React.CSSProperties,
  sendButton: {
    width: '36px',
    height: '36px',
    borderRadius: '6px',
    border: 'none',
    background: '#005bd3',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  sendButtonDisabled: {
    background: '#d1d5db',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  footer: {
    fontSize: '10px',
    color: '#999',
    padding: '8px 16px',
    margin: '0',
    textAlign: 'center',
    borderTop: '1px solid #f3f4f6',
  } as React.CSSProperties,
};

export default LiveChat;
