import { useState } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { trpc } from '@/lib/trpc';
import { Link } from 'wouter';

interface SearchResult {
  type: 'curve' | 'fund' | 'market';
  id: number;
  code: string;
  name: string;
  nameEn?: string;
  category?: string;
  region?: string;
  currency?: string;
  description?: string;
}

const SearchResults = () => {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setShowSuggestions(false);
  };

  const handleInputChange = (value: string) => {
    setSearchQuery(value);
    setShowSuggestions(value.trim().length > 0);
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSearch(suggestion);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'curve': return '曲线';
      case 'fund': return '基金';
      case 'market': return '市场数据';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'curve': return 'bg-blue-500/20 text-blue-400';
      case 'fund': return 'bg-purple-500/20 text-purple-400';
      case 'market': return 'bg-green-500/20 text-green-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getResultLink = (result: SearchResult) => {
    switch (result.type) {
      case 'curve': return `/curve-detail/${result.id}`;
      case 'fund': return `/fund-browse?search=${encodeURIComponent(result.code)}`;
      case 'market': return `/market`;
      default: return '#';
    }
  };

  // Use tRPC query directly — no intermediate state to avoid infinite loops
  const { data: results = [], isLoading: isSearching } = trpc.search.unified.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length > 0 }
  );

  const { data: suggestions = [] } = trpc.search.suggestions.useQuery(
    { query: searchQuery },
    { enabled: searchQuery.trim().length > 0 && showSuggestions }
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">搜索结果</h1>
        <div className="text-sm text-muted-foreground">
          {results.length > 0 && `找到 ${results.length} 个结果`}
        </div>
      </div>

      {/* Search Bar */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>搜索</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Input
              placeholder="搜索曲线、基金、市场数据..."
              value={searchQuery}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleSearch(searchQuery);
              }}
              className="bg-background border-border text-foreground"
            />
            <Button
              onClick={() => handleSearch(searchQuery)}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              搜索
            </Button>

            {/* Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-background border border-border rounded-md shadow-lg z-10">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="w-full text-left px-4 py-2 hover:bg-muted text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isSearching ? (
        <div className="flex justify-center items-center h-96">
          <Spinner />
        </div>
      ) : results.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {results.map((result, idx) => (
            <Link key={idx} href={getResultLink(result)}>
              <Card className="bg-card border-border hover:border-primary/50 cursor-pointer transition-all hover:shadow-lg">
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-mono text-primary">{result.code}</p>
                        <h3 className="text-lg font-semibold text-foreground mt-1">{result.name}</h3>
                        {result.nameEn && (
                          <p className="text-sm text-muted-foreground">{result.nameEn}</p>
                        )}
                      </div>
                      <Badge className={getTypeColor(result.type)}>
                        {getTypeLabel(result.type)}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-sm">
                      {result.category && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">类别</span>
                          <span className="text-foreground">{result.category}</span>
                        </div>
                      )}
                      {result.region && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">地区</span>
                          <span className="text-foreground">{result.region}</span>
                        </div>
                      )}
                      {result.currency && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">货币</span>
                          <span className="text-foreground">{result.currency}</span>
                        </div>
                      )}
                    </div>

                    {result.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {result.description}
                      </p>
                    )}

                    <Button
                      variant="outline"
                      className="w-full mt-4 border-border hover:bg-muted"
                    >
                      查看详情
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : searchQuery ? (
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              未找到与 "{searchQuery}" 相关的结果
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card border-border">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              输入搜索词开始查询
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SearchResults;
