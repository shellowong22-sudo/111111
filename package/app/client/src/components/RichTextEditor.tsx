import { useState, useRef, useCallback } from 'react';
import { Bold, Italic, Underline, Link, List, ListOrdered, Undo, Redo, Type, Image, Table } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: string;
}

export default function RichTextEditor({ value, onChange, placeholder = '输入内容...', minHeight = '150px' }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showTableInput, setShowTableInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [tableRows, setTableRows] = useState('3');
  const [tableCols, setTableCols] = useState('3');
  const [uploading, setUploading] = useState(false);

  const execCommand = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInsertLink = () => {
    if (!linkUrl) return;
    const text = linkText || linkUrl;
    const html = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-400 underline">${text}</a>`;
    
    editorRef.current?.focus();
    document.execCommand('insertHTML', false, html);
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    setShowLinkInput(false);
    setLinkUrl('');
    setLinkText('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('图片大小不能超过 5MB');
      return;
    }

    setUploading(true);
    try {
      // Convert to base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Upload to server
      const response = await fetch('/api/upload/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: base64,
          filename: file.name,
          contentType: file.type,
        }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const { url } = await response.json();
      
      // Insert image into editor
      const imgHtml = `<img src="${url}" alt="${file.name}" style="max-width:100%;height:auto;border-radius:4px;margin:8px 0;" />`;
      editorRef.current?.focus();
      document.execCommand('insertHTML', false, imgHtml);
      
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML);
      }
      toast.success('图片上传成功');
    } catch (error) {
      toast.error('图片上传失败，请重试');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInsertTable = () => {
    const rows = parseInt(tableRows) || 3;
    const cols = parseInt(tableCols) || 3;
    
    if (rows < 1 || rows > 20 || cols < 1 || cols > 10) {
      toast.error('行数范围 1-20，列数范围 1-10');
      return;
    }

    let tableHtml = '<table style="width:100%;border-collapse:collapse;margin:8px 0;border:1px solid #374151;">';
    // Header row
    tableHtml += '<thead><tr>';
    for (let c = 0; c < cols; c++) {
      tableHtml += `<th style="border:1px solid #374151;padding:6px 10px;background:#1f2937;text-align:left;font-weight:600;">标题${c + 1}</th>`;
    }
    tableHtml += '</tr></thead>';
    // Body rows
    tableHtml += '<tbody>';
    for (let r = 0; r < rows - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cols; c++) {
        tableHtml += `<td style="border:1px solid #374151;padding:6px 10px;">内容</td>`;
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br/></p>';

    editorRef.current?.focus();
    document.execCommand('insertHTML', false, tableHtml);
    
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    setShowTableInput(false);
    setTableRows('3');
    setTableCols('3');
    toast.success('表格已插入');
  };

  const toolbarButtons = [
    { icon: Bold, command: 'bold', title: '加粗 (Ctrl+B)' },
    { icon: Italic, command: 'italic', title: '斜体 (Ctrl+I)' },
    { icon: Underline, command: 'underline', title: '下划线 (Ctrl+U)' },
    { icon: null, command: 'separator' },
    { icon: List, command: 'insertUnorderedList', title: '无序列表' },
    { icon: ListOrdered, command: 'insertOrderedList', title: '有序列表' },
    { icon: null, command: 'separator' },
    { icon: Link, command: 'link', title: '插入链接' },
    { icon: Image, command: 'image', title: '插入图片' },
    { icon: Table, command: 'table', title: '插入表格' },
    { icon: null, command: 'separator' },
    { icon: Type, command: 'removeFormat', title: '清除格式' },
    { icon: Undo, command: 'undo', title: '撤销 (Ctrl+Z)' },
    { icon: Redo, command: 'redo', title: '重做 (Ctrl+Y)' },
  ];

  return (
    <div className="border border-border rounded-md overflow-hidden bg-background">
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30 flex-wrap">
        {toolbarButtons.map((btn, idx) => {
          if (btn.command === 'separator') {
            return <div key={idx} className="w-px h-5 bg-border mx-1" />;
          }
          const Icon = btn.icon!;
          return (
            <Button
              key={idx}
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 hover:bg-muted"
              title={btn.title}
              disabled={btn.command === 'image' && uploading}
              onClick={() => {
                if (btn.command === 'link') {
                  setShowLinkInput(!showLinkInput);
                  setShowTableInput(false);
                } else if (btn.command === 'image') {
                  fileInputRef.current?.click();
                } else if (btn.command === 'table') {
                  setShowTableInput(!showTableInput);
                  setShowLinkInput(false);
                } else {
                  execCommand(btn.command);
                }
              }}
            >
              <Icon className="w-3.5 h-3.5" />
            </Button>
          );
        })}
        {uploading && (
          <span className="text-xs text-muted-foreground ml-2 animate-pulse">上传中...</span>
        )}
      </div>

      {/* Link input */}
      {showLinkInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
          <Input
            value={linkText}
            onChange={e => setLinkText(e.target.value)}
            placeholder="链接文本（可选）"
            className="h-7 text-xs flex-1"
          />
          <Input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="h-7 text-xs flex-1"
          />
          <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={handleInsertLink} disabled={!linkUrl}>
            插入
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowLinkInput(false)}>
            取消
          </Button>
        </div>
      )}

      {/* Table input */}
      {showTableInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/20">
          <span className="text-xs text-muted-foreground whitespace-nowrap">行数:</span>
          <Input
            value={tableRows}
            onChange={e => setTableRows(e.target.value)}
            type="number"
            min="1"
            max="20"
            className="h-7 text-xs w-16"
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap">列数:</span>
          <Input
            value={tableCols}
            onChange={e => setTableCols(e.target.value)}
            type="number"
            min="1"
            max="10"
            className="h-7 text-xs w-16"
          />
          <Button type="button" size="sm" className="h-7 text-xs px-2" onClick={handleInsertTable}>
            插入表格
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => setShowTableInput(false)}>
            取消
          </Button>
        </div>
      )}

      {/* Editor area */}
      <div
        ref={editorRef}
        contentEditable
        className={cn(
          'px-3 py-2 text-sm outline-none overflow-y-auto',
          'prose prose-sm prose-invert max-w-none',
          '[&_a]:text-blue-400 [&_a]:underline',
          '[&_ul]:list-disc [&_ul]:pl-5',
          '[&_ol]:list-decimal [&_ol]:pl-5',
          '[&_b]:font-bold [&_strong]:font-bold',
          '[&_i]:italic [&_em]:italic',
          '[&_img]:max-w-full [&_img]:rounded',
          '[&_table]:w-full [&_table]:border-collapse',
          '[&_th]:border [&_th]:border-border [&_th]:p-1.5 [&_th]:bg-muted/50 [&_th]:text-left [&_th]:font-semibold [&_th]:text-xs',
          '[&_td]:border [&_td]:border-border [&_td]:p-1.5 [&_td]:text-xs',
          !value && 'text-muted-foreground'
        )}
        style={{ minHeight }}
        onInput={handleInput}
        onBlur={handleInput}
        dangerouslySetInnerHTML={{ __html: value || '' }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      {/* Character count */}
      <div className="px-3 py-1 border-t border-border text-[10px] text-muted-foreground text-right">
        {stripHtml(value).length} 字符
      </div>
    </div>
  );
}

function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}
