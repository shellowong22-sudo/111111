/**
 * CommunicationsHub - 通讯与社区中心
 * 覆盖：即时消息、联系人管理、社区讨论、文件共享、市场聊天室
 */
import { useState, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, Users, Hash, FileText, Send, Search,
  Star, Phone, Video, MoreHorizontal, Pin, Bell, TrendingUp,
  TrendingDown, Circle, CheckCheck, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CommunicationsEvidenceDesk from '@/components/comms/CommunicationsEvidenceDesk';

// ── 联系人数据 ────────────────────────────────────────────────────────────────
const CONTACTS = [
  { id: 1, name: '张伟', title: '首席策略师', firm: '中信证券', status: 'online', unread: 3, lastMsg: '今日 A 股大盘如何看？', time: '09:32', avatar: '张', specialty: '权益' },
  { id: 2, name: '李明', title: '固收分析师', firm: '华泰证券', status: 'online', unread: 0, lastMsg: '10Y 国债收益率突破 2.3%', time: '09:18', avatar: '李', specialty: '债券' },
  { id: 3, name: 'David Chen', title: 'Portfolio Manager', firm: 'BlackRock', status: 'away', unread: 1, lastMsg: 'EM flows turning positive', time: '08:55', avatar: 'D', specialty: '全球宏观' },
  { id: 4, name: '王芳', title: '量化研究员', firm: '国泰君安', status: 'online', unread: 0, lastMsg: 'Alpha 因子回测结果出来了', time: '08:41', avatar: '王', specialty: '量化' },
  { id: 5, name: 'Sarah Kim', title: 'FX Strategist', firm: 'Goldman Sachs', status: 'offline', unread: 0, lastMsg: 'USD/CNY watch 7.30 level', time: '昨天', avatar: 'S', specialty: '外汇' },
  { id: 6, name: '陈浩', title: '行业研究员', firm: '招商证券', status: 'online', unread: 2, lastMsg: '半导体板块估值修复逻辑', time: '09:05', avatar: '陈', specialty: '科技' },
];

// ── 聊天室数据 ────────────────────────────────────────────────────────────────
const CHAT_ROOMS = [
  { id: 'macro', name: '宏观策略', members: 1247, unread: 12, hot: true, desc: '全球宏观经济与政策讨论' },
  { id: 'equity', name: 'A股市场', members: 3892, unread: 45, hot: true, desc: '沪深港通、板块轮动、个股分析' },
  { id: 'fixed', name: '固定收益', members: 876, unread: 3, hot: false, desc: '利率债、信用债、可转债' },
  { id: 'forex', name: '外汇商品', members: 654, unread: 8, hot: false, desc: 'FX、大宗商品、贵金属' },
  { id: 'quant', name: '量化交易', members: 1123, unread: 0, hot: false, desc: '策略分享、因子研究、回测' },
  { id: 'global', name: '全球市场', members: 2341, unread: 21, hot: true, desc: '美股、欧股、新兴市场' },
];

// ── 消息数据 ──────────────────────────────────────────────────────────────────
const MESSAGES: Record<string, { id: number; sender: string; avatar: string; text: string; time: string; self?: boolean; type?: string }[]> = {
  macro: [
    { id: 1, sender: '张伟', avatar: '张', text: '美联储 6 月会议纪要显示官员对通胀路径仍有分歧，降息时间表不确定性增加', time: '09:15' },
    { id: 2, sender: 'David Chen', avatar: 'D', text: 'Fed minutes were more hawkish than expected. USD strength likely to persist into Q3', time: '09:18' },
    { id: 3, sender: '李明', avatar: '李', text: '国内方面，央行维持 LPR 不变，但 MLF 操作量超预期，流动性保持宽松', time: '09:22' },
    { id: 4, sender: '王芳', avatar: '王', text: '从量化角度看，当前宏观因子对 A 股的解释力下降，市场进入结构性行情', time: '09:28' },
    { id: 5, sender: '我', avatar: '我', text: '同意，当前市场主要看政策预期，基本面的边际变化影响有限', time: '09:31', self: true },
    { id: 6, sender: '陈浩', avatar: '陈', text: '科技板块受益于 AI 算力需求，估值已有较大修复，需关注业绩兑现', time: '09:35' },
    { id: 7, sender: '张伟', avatar: '张', text: '今日 A 股大盘如何看？技术面上 3200 点支撑较强', time: '09:38' },
  ],
  equity: [
    { id: 1, sender: '陈浩', avatar: '陈', text: '半导体板块今日开盘强势，华为产业链受益明显', time: '09:30' },
    { id: 2, sender: '王芳', avatar: '王', text: '量化信号显示，消费板块超卖，可能有技术反弹', time: '09:33' },
    { id: 3, sender: '张伟', avatar: '张', text: '北向资金今日净流入 15 亿，外资对 A 股态度转暖', time: '09:36' },
  ],
};

// ── 社区帖子 ──────────────────────────────────────────────────────────────────
const COMMUNITY_POSTS = [
  {
    id: 1, author: '宏观老王', avatar: '宏', title: '【深度】美联储降息路径的三种情景分析',
    content: '基于当前通胀数据和就业市场，我们构建了三种降息情景：基准情景（9月首降）、鹰派情景（12月首降）、鸽派情景（7月首降）...',
    likes: 234, comments: 45, views: 3421, time: '2小时前', tags: ['宏观', '美联储', '利率'],
    sentiment: 'neutral',
  },
  {
    id: 2, author: '量化小李', avatar: '量', title: '【策略】A股动量因子在当前市场的有效性研究',
    content: '通过对 2020-2024 年 A 股全市场数据的回测，动量因子在震荡市中表现明显弱化，但在趋势市中 IC 均值达到 0.08...',
    likes: 189, comments: 32, views: 2876, time: '4小时前', tags: ['量化', 'A股', '因子'],
    sentiment: 'positive',
  },
  {
    id: 3, author: '债券分析师', avatar: '债', title: '【债市】信用利差收窄背后的风险与机会',
    content: '当前 AA+ 级城投债与国债利差已压缩至历史低位 80bps，性价比明显下降，建议关注高等级产业债...',
    likes: 156, comments: 28, views: 2134, time: '6小时前', tags: ['债券', '信用', '城投'],
    sentiment: 'warning',
  },
  {
    id: 4, author: 'FX交易员', avatar: 'F', title: '【外汇】人民币汇率：7.3 是否是新均衡？',
    content: '从购买力平价、利率平价、经常账户等多维度分析，当前 USD/CNY 7.25-7.35 区间具有较强支撑...',
    likes: 312, comments: 67, views: 4523, time: '8小时前', tags: ['外汇', '人民币', '汇率'],
    sentiment: 'neutral',
  },
];

// ── 文件共享数据 ──────────────────────────────────────────────────────────────
const SHARED_FILES = [
  { name: '2024Q2宏观策略报告.pdf', size: '2.4 MB', sender: '张伟', time: '今天 09:00', type: 'pdf', downloads: 45 },
  { name: 'A股行业轮动模型.xlsx', size: '1.8 MB', sender: '王芳', time: '今天 08:30', type: 'excel', downloads: 23 },
  { name: '美联储会议纪要解读.docx', size: '0.9 MB', sender: 'David Chen', time: '昨天 18:45', type: 'word', downloads: 67 },
  { name: '固收投资组合优化框架.pptx', size: '5.2 MB', sender: '李明', time: '昨天 16:20', type: 'ppt', downloads: 34 },
  { name: '量化因子回测数据.csv', size: '12.3 MB', sender: '王芳', time: '2天前', type: 'csv', downloads: 89 },
];

const STATUS_COLOR = { online: 'bg-green-500', away: 'bg-amber-500', offline: 'bg-gray-600' };

function HistoricalCommunicationsHub() {
  const [activeTab, setActiveTab] = useState('messages');
  const [selectedContact, setSelectedContact] = useState(CONTACTS[0]);
  const [selectedRoom, setSelectedRoom] = useState(CHAT_ROOMS[0]);
  const [inputMsg, setInputMsg] = useState('');
  const [roomMessages, setRoomMessages] = useState(MESSAGES);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedRoom, roomMessages]);

  const sendMessage = (roomId: string) => {
    if (!inputMsg.trim()) return;
    setRoomMessages(prev => ({
      ...prev,
      [roomId]: [
        ...(prev[roomId] || []),
        { id: Date.now(), sender: '我', avatar: '我', text: inputMsg, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }), self: true },
      ],
    }));
    setInputMsg('');
  };

  const filteredContacts = CONTACTS.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.firm.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
          <MessageSquare className="w-4 h-4 text-purple-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-purple-400">通讯与社区中心</h1>
          <p className="text-xs text-gray-500">即时消息 · 市场聊天室 · 社区讨论 · 文件共享</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-1 p-1">
          {[
            { value: 'messages', label: '即时消息', icon: MessageSquare },
            { value: 'rooms', label: '市场聊天室', icon: Hash },
            { value: 'community', label: '社区讨论', icon: Users },
            { value: 'files', label: '文件共享', icon: FileText },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value}
              className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400 flex items-center gap-1">
              <t.icon className="w-3 h-3" />
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 即时消息 ── */}
        <TabsContent value="messages">
          <div className="flex gap-4 h-[600px]">
            {/* 联系人列表 */}
            <div className="w-72 bg-gray-900 border border-gray-800 rounded-lg flex flex-col">
              <div className="p-3 border-b border-gray-800">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                  <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    placeholder="搜索联系人..." className="h-7 text-xs bg-gray-800 border-gray-700 pl-7" />
                </div>
              </div>
              <ScrollArea className="flex-1">
                {filteredContacts.map(contact => (
                  <div key={contact.id} onClick={() => setSelectedContact(contact)}
                    className={cn('flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-800 transition-colors',
                      selectedContact.id === contact.id && 'bg-purple-900/20 border-l-2 border-purple-500')}>
                    <div className="relative flex-shrink-0">
                      <Avatar className="w-8 h-8 bg-gray-700">
                        <AvatarFallback className="text-xs bg-gray-700 text-gray-300">{contact.avatar}</AvatarFallback>
                      </Avatar>
                      <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900', STATUS_COLOR[contact.status as keyof typeof STATUS_COLOR])} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-200 truncate">{contact.name}</span>
                        <span className="text-[10px] text-gray-600 flex-shrink-0 ml-1">{contact.time}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 truncate">{contact.lastMsg}</span>
                        {contact.unread > 0 && (
                          <span className="bg-purple-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 ml-1">
                            {contact.unread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* 聊天区域 */}
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg flex flex-col">
              {/* 聊天头部 */}
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs bg-gray-700 text-gray-300">{selectedContact.avatar}</AvatarFallback>
                    </Avatar>
                    <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-900', STATUS_COLOR[selectedContact.status as keyof typeof STATUS_COLOR])} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-200">{selectedContact.name}</div>
                    <div className="text-[10px] text-gray-500">{selectedContact.title} · {selectedContact.firm}</div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-purple-800 text-purple-400">{selectedContact.specialty}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-300"><Phone className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-300"><Video className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-500 hover:text-gray-300"><Star className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {/* 消息列表 */}
              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {(MESSAGES['macro'] || []).map(msg => (
                    <div key={msg.id} className={cn('flex gap-2', msg.self && 'flex-row-reverse')}>
                      {!msg.self && (
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="text-[10px] bg-gray-700 text-gray-300">{msg.avatar}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn('max-w-[70%]', msg.self && 'items-end flex flex-col')}>
                        {!msg.self && <div className="text-[10px] text-gray-500 mb-0.5">{msg.sender}</div>}
                        <div className={cn('text-xs rounded-lg px-3 py-2 leading-relaxed',
                          msg.self ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200')}>
                          {msg.text}
                        </div>
                        <div className={cn('text-[10px] text-gray-600 mt-0.5 flex items-center gap-1', msg.self && 'flex-row-reverse')}>
                          {msg.time}
                          {msg.self && <CheckCheck className="w-3 h-3 text-purple-400" />}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* 输入区 */}
              <div className="px-4 py-3 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Input value={inputMsg} onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage('macro')}
                    placeholder="输入消息... (Enter 发送)" className="flex-1 h-8 text-xs bg-gray-800 border-gray-700" />
                  <Button size="sm" onClick={() => sendMessage('macro')}
                    className="h-8 bg-purple-600 hover:bg-purple-700 text-white">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 市场聊天室 ── */}
        <TabsContent value="rooms">
          <div className="flex gap-4 h-[600px]">
            {/* 聊天室列表 */}
            <div className="w-64 bg-gray-900 border border-gray-800 rounded-lg flex flex-col">
              <div className="px-3 py-2 border-b border-gray-800">
                <span className="text-xs font-semibold text-gray-400">市场聊天室</span>
              </div>
              <ScrollArea className="flex-1">
                {CHAT_ROOMS.map(room => (
                  <div key={room.id} onClick={() => setSelectedRoom(room)}
                    className={cn('px-3 py-2.5 cursor-pointer hover:bg-gray-800 transition-colors',
                      selectedRoom.id === room.id && 'bg-purple-900/20 border-l-2 border-purple-500')}>
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <Hash className="w-3 h-3 text-gray-500" />
                        <span className="text-xs font-semibold text-gray-200">{room.name}</span>
                        {room.hot && <Badge className="text-[9px] bg-red-900/50 text-red-400 border-red-800 px-1 py-0" variant="outline">热</Badge>}
                      </div>
                      {room.unread > 0 && (
                        <span className="bg-purple-500 text-white text-[9px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
                          {room.unread}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-gray-600 flex items-center gap-2">
                      <Users className="w-2.5 h-2.5" />
                      {room.members.toLocaleString()} 成员
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>

            {/* 聊天室内容 */}
            <div className="flex-1 bg-gray-900 border border-gray-800 rounded-lg flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-purple-400" />
                  <span className="text-sm font-bold text-gray-200">{selectedRoom.name}</span>
                  <span className="text-xs text-gray-500">{selectedRoom.desc}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Users className="w-3 h-3" />
                  {selectedRoom.members.toLocaleString()} 在线
                </div>
              </div>

              <ScrollArea className="flex-1 px-4 py-3">
                <div className="space-y-3">
                  {(roomMessages[selectedRoom.id] || MESSAGES['macro']).map(msg => (
                    <div key={msg.id} className={cn('flex gap-2', msg.self && 'flex-row-reverse')}>
                      {!msg.self && (
                        <Avatar className="w-7 h-7 flex-shrink-0">
                          <AvatarFallback className="text-[10px] bg-gray-700 text-gray-300">{msg.avatar}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className={cn('max-w-[75%]', msg.self && 'items-end flex flex-col')}>
                        {!msg.self && <div className="text-[10px] text-gray-500 mb-0.5">{msg.sender}</div>}
                        <div className={cn('text-xs rounded-lg px-3 py-2 leading-relaxed',
                          msg.self ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-200')}>
                          {msg.text}
                        </div>
                        <div className="text-[10px] text-gray-600 mt-0.5">{msg.time}</div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              <div className="px-4 py-3 border-t border-gray-800">
                <div className="flex items-center gap-2">
                  <Input value={inputMsg} onChange={e => setInputMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage(selectedRoom.id)}
                    placeholder={`在 #${selectedRoom.name} 中发言...`} className="flex-1 h-8 text-xs bg-gray-800 border-gray-700" />
                  <Button size="sm" onClick={() => sendMessage(selectedRoom.id)}
                    className="h-8 bg-purple-600 hover:bg-purple-700 text-white">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── 社区讨论 ── */}
        <TabsContent value="community" className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['全部', '宏观', 'A股', '债券', '外汇', '量化'].map(tag => (
                <Button key={tag} variant="outline" size="sm"
                  className="h-7 text-xs border-gray-700 bg-transparent text-gray-400 hover:text-purple-400 hover:border-purple-700">
                  {tag}
                </Button>
              ))}
            </div>
            <Button size="sm" className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white">
              + 发帖
            </Button>
          </div>

          <div className="space-y-3">
            {COMMUNITY_POSTS.map(post => (
              <Card key={post.id} className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors cursor-pointer">
                <CardContent className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-9 h-9 flex-shrink-0">
                      <AvatarFallback className="text-xs bg-gray-700 text-gray-300">{post.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-sm font-semibold text-gray-200 hover:text-purple-400 transition-colors">{post.title}</h3>
                        <span className="text-[10px] text-gray-600 flex-shrink-0 ml-2 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{post.time}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 line-clamp-2">{post.content}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-gray-600">by <span className="text-gray-400">{post.author}</span></span>
                          <div className="flex gap-1">
                            {post.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-[9px] border-gray-700 text-gray-500 px-1.5 py-0">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-gray-600">
                          <span className="flex items-center gap-1"><Star className="w-3 h-3" />{post.likes}</span>
                          <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{post.comments}</span>
                          <span>{post.views.toLocaleString()} 阅读</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── 文件共享 ── */}
        <TabsContent value="files" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-64">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
              <Input placeholder="搜索文件..." className="h-8 text-xs bg-gray-900 border-gray-700 pl-7" />
            </div>
            <Button size="sm" className="h-8 text-xs bg-purple-600 hover:bg-purple-700 text-white">
              + 上传文件
            </Button>
          </div>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-800">
                <div className="grid grid-cols-5 gap-4 px-4 py-2 text-[10px] text-gray-600 font-semibold">
                  <span className="col-span-2">文件名</span>
                  <span>大小</span>
                  <span>发送者</span>
                  <span>时间</span>
                </div>
                {SHARED_FILES.map((file, i) => (
                  <div key={i} className="grid grid-cols-5 gap-4 px-4 py-3 hover:bg-gray-800 transition-colors items-center">
                    <div className="col-span-2 flex items-center gap-2">
                      <div className={cn('w-7 h-7 rounded flex items-center justify-center text-[10px] font-bold',
                        file.type === 'pdf' ? 'bg-red-900/50 text-red-400' :
                        file.type === 'excel' ? 'bg-green-900/50 text-green-400' :
                        file.type === 'ppt' ? 'bg-orange-900/50 text-orange-400' :
                        file.type === 'csv' ? 'bg-blue-900/50 text-blue-400' : 'bg-gray-800 text-gray-400')}>
                        {file.type.toUpperCase().slice(0, 3)}
                      </div>
                      <span className="text-xs text-gray-300 truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{file.size}</span>
                    <span className="text-xs text-gray-400">{file.sender}</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">{file.time}</span>
                      <Button variant="ghost" size="sm" className="h-6 text-[10px] text-purple-400 hover:text-purple-300 px-2">
                        下载 ({file.downloads})
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CommunicationsHub() {
  const [showHistorical, setShowHistorical] = useState(false);
  return <div className="min-h-screen bg-gray-950 p-4 text-gray-100"><CommunicationsEvidenceDesk title="通讯与社区中心" /><details className="mt-4 rounded-lg border border-gray-800 bg-gray-900" onToggle={(event) => setShowHistorical((event.currentTarget as HTMLDetailsElement).open)} data-communications-historical-content="true"><summary className="cursor-pointer px-3 py-2 text-xs text-gray-500 hover:text-gray-300">保留原即时消息、聊天室、社区与文件展示（非事实）</summary>{showHistorical && <div className="pointer-events-none select-none border-t border-gray-800 opacity-80"><p className="m-3 rounded border border-amber-900/60 bg-amber-950/20 p-2 text-[10px] leading-4 text-amber-100" data-communications-historical-boundary="true">以下完整保留原联系人、在线状态、私信、聊天室成员、未读数、社区帖子、互动统计、共享文件和上传/下载/发送结构。它们没有当前消息、成员、权限、公告、社群或文件来源，且已禁用交互，不代表任何真实通讯活动。</p><HistoricalCommunicationsHub /></div>}</details></div>;
}
