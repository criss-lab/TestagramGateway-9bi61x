import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Link2, AlertCircle } from 'lucide-react';

interface FediverseConnectProps {
  onConnect: (identity: any) => Promise<void>;
  isOpen: boolean;
  onClose: () => void;
}

const FediverseConnect: React.FC<FediverseConnectProps> = ({
  onConnect,
  isOpen,
  onClose,
}) => {
  const [step, setStep] = useState<'select' | 'mastodon' | 'bluesky' | 'lemmy'>('select');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [handle, setHandle] = useState('');
  const [instance, setInstance] = useState('mastodon.social');

  const handleConnect = async (platform: string) => {
    setLoading(true);
    try {
      if (platform === 'mastodon') {
        if (!handle || !instance) {
          toast.error('Please enter handle and instance');
          setLoading(false);
          return;
        }
        await onConnect({
          platform: 'mastodon',
          handle,
          instance,
        });
      } else if (platform === 'bluesky') {
        if (!handle) {
          toast.error('Please enter your Bluesky handle');
          setLoading(false);
          return;
        }
        await onConnect({
          platform: 'bluesky',
          handle,
        });
      } else if (platform === 'lemmy') {
        if (!handle || !instance) {
          toast.error('Please enter handle and instance');
          setLoading(false);
          return;
        }
        await onConnect({
          platform: 'lemmy',
          handle,
          instance,
        });
      }
      toast.success(`Connected to ${platform}!`);
      onClose();
    } catch (error) {
      toast.error(`Failed to connect to ${platform}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Connect to Fediverse
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-4 py-6">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('mastodon')}
                className="h-20 flex flex-col items-center justify-center"
              >
                <div className="text-2xl mb-2">🐘</div>
                <span>Mastodon</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('bluesky')}
                className="h-20 flex flex-col items-center justify-center"
              >
                <div className="text-2xl mb-2">🦋</div>
                <span>Bluesky</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep('lemmy')}
                className="h-20 flex flex-col items-center justify-center"
              >
                <div className="text-2xl mb-2">📰</div>
                <span>Lemmy</span>
              </Button>
              <Button
                variant="outline"
                disabled
                className="h-20 flex flex-col items-center justify-center opacity-50"
              >
                <div className="text-2xl mb-2">🔗</div>
                <span>More Coming</span>
              </Button>
            </div>
          </div>
        )}

        {step === 'mastodon' && (
          <div className="space-y-4 py-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Enter your Mastodon handle and instance. Your account must be public.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Handle</label>
              <Input
                placeholder="username"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Instance</label>
              <Input
                placeholder="mastodon.social"
                value={instance}
                onChange={(e) => setInstance(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('select')} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={() => handleConnect('mastodon')}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'bluesky' && (
          <div className="space-y-4 py-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Enter your Bluesky handle (e.g., username.bsky.social)
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bluesky Handle</label>
              <Input
                placeholder="username.bsky.social"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('select')} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={() => handleConnect('bluesky')}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 'lemmy' && (
          <div className="space-y-4 py-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Enter your Lemmy username and instance URL.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Username</label>
              <Input
                placeholder="username"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Instance</label>
              <Input
                placeholder="lemmy.ml"
                value={instance}
                onChange={(e) => setInstance(e.target.value)}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" onClick={() => setStep('select')} disabled={loading}>
                Back
              </Button>
              <Button
                onClick={() => handleConnect('lemmy')}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FediverseConnect;
