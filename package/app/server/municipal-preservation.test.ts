import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const expected = ['1','MSRC','SMUN','AAA','BTMM','PICK','MBWD','CDRN','CDRC','CDRA','CNDS','CDRV','DEAL','CACT','MCAL','MBIX','VRDN','BMA','BOOM','MSRB','SLGS'];

describe('municipal original-entry protection and non-stacked workspaces', () => {
  it('keeps all 21 original menu entries in their original order', () => {
    const menu=read('client/src/components/LocalBondMenu.tsx');
    const offsets=expected.map(id=>menu.indexOf(`id: '${id}'`));
    expect(offsets.every(offset=>offset>=0)).toBe(true);
    expect(offsets.every((offset,index)=>index===0||offset>offsets[index-1])).toBe(true);
  });
  it('preserves each original component and its entry mapping', () => {
    const terminal=read('client/src/pages/Terminal.tsx');
    expected.forEach(id=>expect(terminal).toMatch(new RegExp(`retained\\(\\s*["']${id}["'],`)));
    expect(terminal).toContain('original={original}');
  });
  it('replaces the former stacked sources and research components with one active workspace', () => {
    const wrapper=read('client/src/components/municipal/MunicipalPreservedModule.tsx');
    expect(wrapper).toContain('MunicipalTerminalWorkbench');
    expect(wrapper).not.toContain('MunicipalResearchLayer');
    expect(wrapper).toContain('MunicipalWorkspaceFieldSources');
    expect(wrapper).toContain('key={moduleId}');
  });
  it('preserves direct-code routes for the existing municipal functions', () => {
    const terminal=read('client/src/pages/Terminal.tsx');
    ['CDRN','CDRC','CDRA','CNDS','CDRV','DEAL','MCAL','MSRC','SMUN','MBIX','VRDN','BMA','MSRB','SLGS'].forEach(id=>expect(terminal).toMatch(new RegExp(`retained\\(\\s*["']${id}["'],`)));
  });
  it('does not re-mount the duplicated legacy fixture view inside an upgraded entry', () => {
    const workspace=read('client/src/components/municipal/MunicipalTerminalWorkbench.tsx');
    expect(workspace).not.toContain('原有子功能');
    expect(workspace).not.toContain('mode === "original"');
    expect(workspace).toContain('if (!label) return <>{original}</>');
  });
  it('uses mutually exclusive file, upload and search views and retains drafts across tabs', () => {
    const workspace=read('client/src/components/municipal/MunicipalTerminalWorkbench.tsx');
    expect(workspace).toContain('archiveTab === "files" ?');
    expect(workspace).toContain('archiveTab === "upload" ?');
    expect(workspace).toContain('DraftContext.Provider');
    expect(workspace).toContain('drafts.current[id] = values');
  });
});
