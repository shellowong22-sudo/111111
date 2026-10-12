import { useState } from 'react';
import { Send, AlertCircle, Users, MessageCircle, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Message } from '@/lib/dataEngine';
import { cn } from '@/lib/utils';
import CommunicationsEvidenceDesk from './comms/CommunicationsEvidenceDesk';

interface Contact {
  id: string;
  name: string;
  status: 'online' | 'away' | 'offline';
  lastMessage?: string;
}

interface Channel {
  id: string;
  name: string;
  type: 'direct' | 'group';
  unread: number;
}

interface MessagingPanelProps {
  title: string;
  channel?: string;
}

export default function MessagingPanel({ title, channel = 'general' }: MessagingPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState<'messages' | 'contacts' | 'channels'>('messages');
  const [selectedChannel, setSelectedChannel] = useState(channel);
  
  // Contacts list
  const [contacts, setContacts] = useState<Contact[]>([
    { id: 'c1', name: 'Alice Johnson', status: 'online', lastMessage: 'See you tomorrow' },
    { id: 'c2', name: 'Bob Smith', status: 'online', lastMessage: 'Got it' },
    { id: 'c3', name: 'Carol White', status: 'away', lastMessage: 'Thanks for the update' },
    { id: 'c4', name: 'David Brown', status: 'offline', lastMessage: 'See you later' },
    { id: 'c5', name: 'Eve Davis', status: 'online', lastMessage: 'Perfect!' },
  ]);

  // Channels/Groups
  const [channels, setChannels] = useState<Channel[]>([
    { id: 'general', name: 'General', type: 'group', unread: 0 },
    { id: 'trading', name: 'Trading', type: 'group', unread: 3 },
    { id: 'research', name: 'Research', type: 'group', unread: 1 },
    { id: 'portfolio', name: 'Portfolio Team', type: 'group', unread: 0 },
    { id: 'alerts', name: 'Market Alerts', type: 'group', unread: 5 },
  ]);

  const handleSendMessage = () => {
    if (inputValue.trim()) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now()}`,
          sender: 'You',
          content: inputValue,
          timestamp: Date.now(),
          type: 'text',
        },
      ]);
      setInputValue('');
    }
  };

  const handleSelectContact = (contact: Contact) => {
    setSelectedChannel(contact.id);
    setActiveTab('messages');
  };

  const handleSelectChannel = (ch: Channel) => {
    setSelectedChannel(ch.id);
    setActiveTab('messages');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'away':
        return 'text-yellow-400';
      case 'offline':
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-3 p-2"><CommunicationsEvidenceDesk title={title} /><details className="rounded border border-border bg-card/30" data-messaging-historical-content="true"><summary className="cursor-pointer px-3 py-2 text-[10px] text-muted-foreground">保留原通讯与社区展示（非事实）</summary><div className="pointer-events-none select-none border-t border-border opacity-80"><p className="m-2 rounded border border-amber-700/60 bg-amber-950/30 p-2 text-[9px] leading-4 text-amber-100" data-messaging-historical-boundary="true">以下区域保留原联系人、频道、在线状态、未读数、模拟消息、公告和发送控件；它们不是当前通讯事实、成员目录、权限记录或发送结果。保留区已禁用交互。</p><div className="flex h-full">
      {/* Sidebar with tabs */}
      <div className="w-48 border-r border-border bg-card/50 flex flex-col">
        <div className="terminal-header border-b border-border">
          <h3 className="terminal-title text-sm">{title}</h3>
        </div>

        {/* Tab buttons */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('messages')}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-mono transition-colors',
              activeTab === 'messages'
                ? 'bg-accent/20 text-accent border-b-2 border-accent'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
            title="Messages"
          >
            <MessageCircle className="w-3 h-3 mx-auto" />
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={cn(
              'flex-1 px-2 py-2 text-xs font-mono transition-colors',
              activeTab === 'contacts'
                ? 'bg-accent/20 text-accent border-b-2 border-accent'
                : 'text-muted-foreground hover:bg-muted/50'
            )}
            title="Contacts"
          >
            <Users className="w-3 h-3 mx-auto" />
          </button>
        </div>

        {/* Contacts List */}
        {activeTab === 'contacts' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-xs text-muted-foreground font-mono mb-2">CONTACTS</div>
            {contacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors',
                  selectedChannel === contact.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-foreground hover:bg-muted/50'
                )}
              >
                <div className="flex items-center gap-2">
                  <Circle className={cn('w-2 h-2 flex-shrink-0', getStatusColor(contact.status))} />
                  <span className="font-mono truncate flex-1">{contact.name}</span>
                </div>
                <div className="text-xs text-muted-foreground ml-4 truncate">{contact.lastMessage}</div>
              </button>
            ))}
          </div>
        )}

        {/* Channels List */}
        {activeTab === 'messages' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-xs text-muted-foreground font-mono mb-2">CHANNELS</div>
            {channels.map((ch) => (
              <button
                key={ch.id}
                onClick={() => handleSelectChannel(ch)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded-sm text-xs transition-colors',
                  selectedChannel === ch.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-foreground hover:bg-muted/50'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono truncate flex-1">#{ch.name}</span>
                  {ch.unread > 0 && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 rounded-sm">
                      {ch.unread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <div className="terminal-header">
          <h3 className="terminal-title">
            {selectedChannel === 'general' ? '#General' : selectedChannel}
          </h3>
          <span className="text-xs text-muted-foreground">
            {contacts.find(c => c.id === selectedChannel)?.status && (
              <span className="inline-flex items-center gap-1">
                <Circle className={cn('w-2 h-2', getStatusColor(contacts.find(c => c.id === selectedChannel)?.status || 'offline'))} />
                {contacts.find(c => c.id === selectedChannel)?.status}
              </span>
            )}
          </span>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto bg-background/50 p-2 space-y-2">
          {messages.length === 0 && <p className="rounded border border-dashed border-border p-3 text-center text-xs text-muted-foreground">没有导入消息记录。</p>}
          {messages.map((msg) => (
            <div key={msg.id} className="text-xs border-l-2 border-accent/30 pl-2 py-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-accent">{msg.sender}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
                {msg.type === 'alert' && <AlertCircle className="w-3 h-3 text-red-400" />}
              </div>
              <p className="text-foreground mt-1 break-words">{msg.content}</p>
            </div>
          ))}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-2 bg-card/50">
          <div className="flex gap-1">
            <Input
              type="text"
              placeholder="Type message..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 h-8 text-xs bg-input border-border"
            />
            <Button
              size="sm"
              onClick={handleSendMessage}
              className="h-8 px-2"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    </div></div></details></div>
  );
}
