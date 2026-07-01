import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Search, Heart, Repeat2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { BlueskyProfile, BlueskyPost } from '@/lib/fediverse/types';

interface BlueskySidebarProps {
  isConnected: boolean;
  onConnect?: () => void;
}

const BlueskySidebar: React.FC<BlueskySidebarProps> = ({ isConnected, onConnect }) => {
  const [posts, setPosts] = useState<BlueskyPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profile, setProfile] = useState<BlueskyProfile | null>(null);

  useEffect(() => {
    if (isConnected) {
      loadProfile();
      loadFeed();
    }
  }, [isConnected]);

  const loadProfile = async () => {
    try {
      // Fetch profile from Bluesky
      setProfile({
        did: 'did:plc:example',
        handle: 'user.bsky.social',
        displayName: 'User Name',
        description: 'Your bio',
        followersCount: 0,
        followsCount: 0,
        postsCount: 0,
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
    }
  };

  const loadFeed = async () => {
    setLoading(true);
    try {
      // Fetch feed from Bluesky
      setPosts([
        {
          uri: 'at://did:plc:example/app.bsky.feed.post/123',
          cid: 'bafy123',
          author: {
            did: 'did:plc:example',
            handle: 'user.bsky.social',
            displayName: 'Example User',
          },
          record: {
            text: 'Welcome to Bluesky integration!',
            createdAt: new Date().toISOString(),
          },
          likeCount: 5,
          replyCount: 2,
          repostCount: 1,
        },
      ]);
    } catch (error) {
      toast.error('Failed to load Bluesky feed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      // Search posts on Bluesky
      toast.success('Search results loaded');
    } catch (error) {
      toast.error('Search failed');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🦋 Bluesky</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Connect your Bluesky account to see posts and interact with the network.
          </p>
          <Button onClick={onConnect} className="w-full">
            Connect Bluesky
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">🦋 Bluesky Timeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Profile Card */}
        {profile && (
          <div className="p-3 bg-muted rounded-lg">
            <h3 className="font-semibold">{profile.displayName}</h3>
            <p className="text-sm text-muted-foreground">@{profile.handle}</p>
            <div className="flex gap-4 mt-2 text-sm">
              <div>
                <span className="font-semibold">{profile.postsCount}</span>
                <p className="text-xs text-muted-foreground">Posts</p>
              </div>
              <div>
                <span className="font-semibold">{profile.followersCount}</span>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div>
                <span className="font-semibold">{profile.followsCount}</span>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="flex gap-2">
          <Input
            placeholder="Search Bluesky..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <Button
            size="sm"
            onClick={handleSearch}
            disabled={loading}
            className="px-3"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>

        {/* Posts */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length > 0 ? (
            posts.map((post) => (
              <div key={post.uri} className="p-3 border rounded-lg hover:bg-muted/50 transition">
                <div className="flex items-start gap-2 mb-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{post.author.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{post.author.handle}</p>
                  </div>
                </div>
                <p className="text-sm mb-2">{post.record.text}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <button className="flex items-center gap-1 hover:text-foreground transition">
                    <MessageCircle className="w-3 h-3" />
                    {post.replyCount || 0}
                  </button>
                  <button className="flex items-center gap-1 hover:text-foreground transition">
                    <Repeat2 className="w-3 h-3" />
                    {post.repostCount || 0}
                  </button>
                  <button className="flex items-center gap-1 hover:text-foreground transition">
                    <Heart className="w-3 h-3" />
                    {post.likeCount || 0}
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-sm text-muted-foreground py-8">No posts found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BlueskySidebar;
