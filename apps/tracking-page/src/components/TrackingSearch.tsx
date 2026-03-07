import React, { useState, useEffect } from 'react';

interface TrackingSearchProps {
  onSearch: (trackingNumber: string) => void;
  isLoading?: boolean;
  error?: string;
}

const TrackingSearch: React.FC<TrackingSearchProps> = ({ 
  onSearch, 
  isLoading = false,
  error = ''
}) => {
  const [searchInput, setSearchInput] = useState('');
  const [searchType, setSearchType] = useState<'tracking' | 'order' | 'phone'>('tracking');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('recentSearches');
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (value.length > 2 && recentSearches.length > 0) {
      const filtered = recentSearches.filter(s => 
        s.toLowerCase().includes(value.toLowerCase())
      );
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSearch = (searchValue: string = searchInput) => {
    if (!searchValue.trim()) return;

    // Add to recent searches
    const updated = [searchValue, ...recentSearches.filter(s => s !== searchValue)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('recentSearches', JSON.stringify(updated));

    onSearch(searchValue);
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setSearchInput(suggestion);
    handleSearch(suggestion);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>Track Your Order</h1>
          <p style={styles.subtitle}>Enter your tracking or order number to see delivery status</p>
        </div>

        {/* Error Message */}
        {error && (
          <div style={styles.errorBanner}>
            <span style={styles.errorIcon}>⚠️</span>
            <div>
              <p style={styles.errorTitle}>Order not found</p>
              <p style={styles.errorText}>{error}</p>
            </div>
          </div>
        )}

        {/* Search Type Tabs */}
        <div style={styles.tabsContainer}>
          {(['tracking', 'order', 'phone'] as const).map(type => (
            <button
              key={type}
              onClick={() => {
                setSearchType(type);
                setSearchInput('');
              }}
              style={{
                ...styles.tab,
                ...(searchType === type ? styles.tabActive : styles.tabInactive)
              }}
            >
              {type === 'tracking' && '📦 Tracking Number'}
              {type === 'order' && '📋 Order Number'}
              {type === 'phone' && '☎️ Phone Number'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={styles.searchContainer}>
          <div style={styles.inputWrapper}>
            <input
              type="text"
              placeholder={
                searchType === 'tracking' ? 'Enter tracking number (e.g., WTX123456789)' :
                searchType === 'order' ? 'Enter order number (e.g., ORD-2024-001)' :
                'Enter phone number (e.g., 555-123-4567)'
              }
              value={searchInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onFocus={() => {
                if (recentSearches.length > 0 && !searchInput) {
                  setShowSuggestions(true);
                  setSuggestions(recentSearches);
                }
              }}
              style={styles.input}
              disabled={isLoading}
            />
            <button
              onClick={() => handleSearch()}
              disabled={isLoading || !searchInput.trim()}
              style={{
                ...styles.searchButton,
                ...(isLoading || !searchInput.trim() ? styles.searchButtonDisabled : {})
              }}
            >
              {isLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Suggestions/Recent Searches */}
          {showSuggestions && (
            <div style={styles.suggestionsDropdown}>
              <p style={styles.suggestionsLabel}>
                {searchInput ? 'Suggestions' : 'Recent Searches'}
              </p>
              {(searchInput ? suggestions : recentSearches).map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(item)}
                  style={styles.suggestionItem}
                >
                  <span style={styles.suggestionIcon}>⏱️</span>
                  <span>{item}</span>
                </button>
              ))}
              {suggestions.length === 0 && searchInput && (
                <p style={styles.noSuggestions}>No matching searches</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Searches Display */}
        {recentSearches.length > 0 && !showSuggestions && (
          <div style={styles.recentContainer}>
            <p style={styles.recentLabel}>Recent Searches</p>
            <div style={styles.recentList}>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSearchInput(search);
                    handleSearch(search);
                  }}
                  style={styles.recentBadge}
                >
                  {search} ×
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Help Text */}
        <div style={styles.helpText}>
          <p style={styles.helpTitle}>Need help?</p>
          <ul style={styles.helpList}>
            <li>Check your confirmation email for tracking number</li>
            <li>Tracking usually updates within 24 hours</li>
            <li>Contact support if you can't find your order</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    padding: '24px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    padding: '48px 32px',
    maxWidth: '600px',
    width: '100%',
  } as React.CSSProperties,
  header: {
    marginBottom: '32px',
    textAlign: 'center',
  } as React.CSSProperties,
  title: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '16px',
    color: '#666',
    margin: '0',
  } as React.CSSProperties,
  errorBanner: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '24px',
    display: 'flex',
    gap: '12px',
  } as React.CSSProperties,
  errorIcon: {
    fontSize: '20px',
    flexShrink: 0,
  } as React.CSSProperties,
  errorTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#dc2626',
    margin: '0 0 4px 0',
  } as React.CSSProperties,
  errorText: {
    fontSize: '13px',
    color: '#991b1b',
    margin: '0',
  } as React.CSSProperties,
  tabsContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  } as React.CSSProperties,
  tab: {
    padding: '12px 16px',
    border: '1px solid #e5e7eb',
    background: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  tabActive: {
    background: '#005bd3',
    color: 'white',
    borderColor: '#005bd3',
  } as React.CSSProperties,
  tabInactive: {
    color: '#666',
  } as React.CSSProperties,
  searchContainer: {
    marginBottom: '24px',
    position: 'relative',
  } as React.CSSProperties,
  inputWrapper: {
    display: 'flex',
    gap: '8px',
  } as React.CSSProperties,
  input: {
    flex: 1,
    padding: '12px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  searchButton: {
    padding: '12px 32px',
    background: '#005bd3',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  searchButtonDisabled: {
    background: '#d1d5db',
    cursor: 'not-allowed',
  } as React.CSSProperties,
  suggestionsDropdown: {
    position: 'absolute',
    top: '100%',
    left: '0',
    right: '0',
    background: 'white',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginTop: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  } as React.CSSProperties,
  suggestionsLabel: {
    padding: '12px 16px 0',
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    margin: '0',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  suggestionItem: {
    width: '100%',
    padding: '12px 16px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    fontSize: '14px',
    color: '#1a1a1a',
    transition: 'background 0.2s',
  } as React.CSSProperties,
  suggestionIcon: {
    fontSize: '16px',
  } as React.CSSProperties,
  noSuggestions: {
    padding: '12px 16px',
    fontSize: '13px',
    color: '#999',
    margin: '0',
  } as React.CSSProperties,
  recentContainer: {
    marginBottom: '24px',
  } as React.CSSProperties,
  recentLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#999',
    margin: '0 0 12px 0',
    textTransform: 'uppercase',
  } as React.CSSProperties,
  recentList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  } as React.CSSProperties,
  recentBadge: {
    padding: '6px 12px',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    color: '#666',
    transition: 'all 0.2s',
  } as React.CSSProperties,
  helpText: {
    background: '#f9fafb',
    padding: '16px',
    borderRadius: '8px',
    borderLeft: '4px solid #005bd3',
  } as React.CSSProperties,
  helpTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0 0 8px 0',
  } as React.CSSProperties,
  helpList: {
    fontSize: '12px',
    color: '#666',
    margin: '0',
    paddingLeft: '20px',
  } as React.CSSProperties,
};

export default TrackingSearch;
