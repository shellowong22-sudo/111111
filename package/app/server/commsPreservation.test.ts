import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const source = (path: string) => readFileSync(resolve(root, path), 'utf8');
const digest = (path: string) => createHash('sha256').update(source(path)).digest('hex');

describe('通讯与社区原内容保护', () => {
  it('固定原始菜单、原通讯中心、主终端消息面板与全部专属面板的内容指纹', () => {
    expect(digest('client/src/components/MessagingCommunityMenu.tsx')).toBe('6f1771bbd388738503fd4acc2746d9e43585a1dd7db9b45c34ed355d441a0f32');
    expect(digest('client/src/pages/CommunicationsHub.tsx')).toBe('3e50251642e1d2cba188343111c27d54dab55a487cd665ca8420b507baa613e2');
    expect(digest('client/src/components/MessagingPanel.tsx')).toBe('77f5920dc45d6e0754a5e5ef0fd3fb34a4f63ac9b823892dbfd4a133f8488ecf');
    expect(digest('client/src/components/comms/CMTYPanel.tsx')).toBe('7fca572d416f68d843be4819835c5b03e30e49f409515f20724e54d7b93a3098');
    expect(digest('client/src/components/comms/CommsSettings.tsx')).toBe('cd7fe2410359d68d2f6128bfc524f43ec5a011b427c4877f6f98a3089911b82e');
    expect(digest('client/src/components/comms/FILEPanel.tsx')).toBe('6ed983e3d5b2f2d97467984d20747f0f6157a88dc1401bb3299a30c3f0f0d19b');
    expect(digest('client/src/components/comms/IBPanel.tsx')).toBe('6a7b3caa3fd53ce7fd9a96e611441e016dece1e9fd3ce4081e8df01fb907bfb3');
    expect(digest('client/src/components/comms/MSGPanel.tsx')).toBe('18b46753281fd62670d3a928efbf0f7eb76892ce08d8a9c053feae9cfedaaf2d');
    expect(digest('client/src/components/comms/NOTEPanel.tsx')).toBe('28425ca3b1edbb3a4139f9cd43807fc23a5b228d3d2819de20f4fd434748b29f');
    expect(digest('client/src/components/comms/PEOPPanel.tsx')).toBe('94b13189cb54d6bfc375a527491a0aad099574a2509455680ed04c8727903eb3');
    expect(digest('client/src/components/comms/SPDLPanel.tsx')).toBe('e9f78468db3815925c7a012b6a1ad0a4c9dae690e649464e6de4f0551209dd0e');
  });

  it('保留原始菜单的 29 个入口、原工作区的四项区域与主终端消息入口', () => {
    const menu = source('client/src/components/MessagingCommunityMenu.tsx');
    const hub = source('client/src/pages/CommunicationsHub.tsx');
    const terminal = source('client/src/pages/Terminal.tsx');
    expect(menu.match(/num: \d+/g)).toHaveLength(29);
    ['即时消息', '市场聊天室', '社区讨论', '文件共享'].forEach((label) => expect(hub).toContain(label));
    expect(terminal).toContain('content: <CommsPreservedModule moduleId="COMMS-TERMINAL"><MessagingPanel title="通讯与社区" channel="general" /></CommsPreservedModule>');
  });
});
