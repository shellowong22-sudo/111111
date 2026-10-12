import React, { useEffect, useMemo, useState } from "react";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronUp,
  Download,
  FolderPlus,
  LayoutGrid,
  Pencil,
  Trash2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

const columns = [
  "symbol",
  "kind",
  "modelStatus",
  "sourceStatus",
  "updatedAt",
] as const;
type Column = (typeof columns)[number];
type CollectionId = number | null;
const gridClass: Record<string, string> = {
  "1": "grid-cols-1",
  "2": "grid-cols-1 md:grid-cols-2",
  "3": "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  "4": "grid-cols-1 md:grid-cols-2 xl:grid-cols-4",
};
const labels: Record<Column, string> = {
  symbol: "代码",
  kind: "类型",
  modelStatus: "模型",
  sourceStatus: "刷新",
  updatedAt: "更新",
};

export default function StockNCEOResearchWatchboard({
  symbol,
  leg,
  onSelectStock,
  onOpenNceo,
}: {
  symbol: string;
  leg: "call" | "put";
  onSelectStock: (symbol: string) => void;
  onOpenNceo: (symbol: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] =
    useState<CollectionId>(null);
  const [draftName, setDraftName] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const utils = trpc.useUtils();
  const boardQuery = trpc.stockNceoWatchlist.getBoard.useQuery(undefined, {
    retry: false,
  });
  const selectedCollection = useMemo(
    () =>
      boardQuery.data?.collections.find(
        item => item.id === selectedCollectionId
      ) ?? null,
    [boardQuery.data?.collections, selectedCollectionId]
  );
  const currentItems = useMemo(
    () =>
      (boardQuery.data?.items ?? []).filter(
        item => item.collectionId === selectedCollectionId
      ),
    [boardQuery.data?.items, selectedCollectionId]
  );
  const currentLayout = useMemo(
    () =>
      selectedCollectionId == null
        ? (boardQuery.data?.layout ?? null)
        : (boardQuery.data?.collectionLayouts.find(
            item => item.collectionId === selectedCollectionId
          ) ?? null),
    [
      boardQuery.data?.collectionLayouts,
      boardQuery.data?.layout,
      selectedCollectionId,
    ]
  );
  const refresh = () => void utils.stockNceoWatchlist.getBoard.invalidate();
  const addItem = trpc.stockNceoWatchlist.addItem.useMutation({
    onSuccess: result => {
      setFeedback(
        result.status === "available"
          ? "已保存至当前登录用户的当前观察池。"
          : result.status === "existing"
            ? "该条目已在当前观察池中。"
            : result.sourceBoundary
      );
      refresh();
    },
  });
  const removeItem = trpc.stockNceoWatchlist.removeItem.useMutation({
    onSuccess: result => {
      setFeedback(
        result.status === "available"
          ? "已从当前观察池移除。"
          : result.sourceBoundary
      );
      refresh();
    },
  });
  const reorderItems = trpc.stockNceoWatchlist.reorderItems.useMutation({
    onSuccess: result => {
      setFeedback(
        result.status === "available"
          ? "当前观察池顺序已保存。"
          : result.sourceBoundary
      );
      refresh();
    },
  });
  const saveLayout = trpc.stockNceoWatchlist.saveLayout.useMutation({
    onSuccess: result => {
      setFeedback(
        result.status === "available"
          ? "当前观察池布局已保存至当前登录用户。"
          : result.sourceBoundary
      );
      refresh();
    },
  });
  const createCollection = trpc.stockNceoWatchlist.createCollection.useMutation(
    {
      onSuccess: result => {
        if (result.collectionId != null)
          setSelectedCollectionId(result.collectionId);
        setFeedback(
          result.status === "available"
            ? "已创建并切换到新的命名观察池。"
            : result.status === "existing"
              ? "已切换到当前登录用户已有的同名观察池。"
              : result.sourceBoundary
        );
        setDraftName("");
        setComposerOpen(false);
        refresh();
      },
    }
  );
  const renameCollection = trpc.stockNceoWatchlist.renameCollection.useMutation(
    {
      onSuccess: result => {
        setFeedback(
          result.status === "available"
            ? "观察池名称已保存。"
            : result.sourceBoundary
        );
        setEditingCollection(false);
        setComposerOpen(false);
        refresh();
      },
    }
  );
  const deleteCollection = trpc.stockNceoWatchlist.deleteCollection.useMutation(
    {
      onSuccess: result => {
        setSelectedCollectionId(null);
        setDeleteArmed(false);
        setFeedback(
          result.status === "available"
            ? "已删除命名观察池；其中条目已保留并回到默认研究观察池。"
            : result.sourceBoundary
        );
        refresh();
      },
    }
  );

  useEffect(() => {
    setDeleteArmed(false);
    if (selectedCollection) setDraftName(selectedCollection.name);
  }, [selectedCollection?.id, selectedCollection?.name]);

  const visibleColumns = useMemo<Column[]>(() => {
    const saved = currentLayout?.visibleColumns;
    if (!Array.isArray(saved)) return [...columns];
    const permitted = saved.filter(
      (value): value is Column =>
        typeof value === "string" &&
        (columns as readonly string[]).includes(value)
    );
    return permitted.length >= 2 ? permitted : [...columns];
  }, [currentLayout?.visibleColumns]);
  const gridColumns = currentLayout?.gridColumns ?? "2";
  const boardPanes = useMemo(() => {
    const paneCount = Math.min(
      Number(gridColumns),
      Math.max(1, currentItems.length)
    );
    const chunkSize = Math.ceil(currentItems.length / paneCount);
    return Array.from({ length: paneCount }, (_, paneIndex) =>
      currentItems.slice(paneIndex * chunkSize, (paneIndex + 1) * chunkSize)
    ).filter(pane => pane.length);
  }, [currentItems, gridColumns]);
  const currentCollectionName =
    selectedCollection?.name ??
    boardQuery.data?.defaultCollectionName ??
    "默认研究观察池";
  const persistLayout = (
    changes: Partial<{
      gridColumns: "1" | "2" | "3" | "4";
      visibleColumns: Column[];
    }>
  ) =>
    saveLayout.mutate({
      collectionId: selectedCollectionId,
      gridColumns: changes.gridColumns ?? gridColumns,
      visibleColumns: changes.visibleColumns ?? visibleColumns,
      layoutName: currentLayout?.layoutName ?? "股票与 NCEO 研究屏风",
    });
  const downloadBoard = () => {
    const rows = [
      "观察池,类别,代码,显示名,模型方向,模型期限,保存时间",
      ...currentItems.map(item =>
        [
          currentCollectionName,
          item.itemType,
          item.symbol,
          item.displayName,
          item.optionSide ?? "",
          item.expiryDays ?? "",
          new Date(item.updatedAt).toISOString(),
        ]
          .map(value => `"${String(value).replaceAll('"', '""')}"`)
          .join(",")
      ),
    ];
    const url = URL.createObjectURL(
      new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${currentCollectionName}-stock-nceo-research-watchboard.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setFeedback(
      `已导出 ${currentItems.length} 条当前观察池记录；文件不包含真实账户或订单数据。`
    );
  };
  const moveItem = (id: number, direction: -1 | 1) => {
    const index = currentItems.findIndex(item => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= currentItems.length) return;
    const order = currentItems.map(item => item.id);
    [order[index], order[target]] = [order[target], order[index]];
    reorderItems.mutate({ collectionId: selectedCollectionId, itemIds: order });
  };
  const submitCollection = () => {
    const name = draftName.trim();
    if (!name) {
      setFeedback("请输入 1 至 64 个字符的观察池名称。");
      return;
    }
    if (selectedCollection && editingCollection)
      renameCollection.mutate({
        id: selectedCollection.id,
        name,
        description: selectedCollection.description ?? null,
      });
    else createCollection.mutate({ name, description: null });
  };
  const mutationPending =
    addItem.isPending ||
    removeItem.isPending ||
    reorderItems.isPending ||
    saveLayout.isPending ||
    createCollection.isPending ||
    renameCollection.isPending ||
    deleteCollection.isPending;

  return (
    <section className="border border-cyan-900/70 bg-[#0d1220] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
            <LayoutGrid className="h-4 w-4" />
            股票与 NCEO 研究屏风
          </h3>
          <p className="mt-1 text-[10px] leading-4 text-slate-500">
            按登录用户保存的股票与 NCEO
            模型观察条目混排。选择命名观察池后，条目顺序和布局均只作用于该池；打开条目会在当前驾驶舱内切换标的或
            NCEO，不跳转第三方。
          </p>
        </div>
        <button
          type="button"
          onClick={downloadBoard}
          className="inline-flex items-center gap-1 border border-cyan-800 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-900/50"
        >
          <Download className="h-3 w-3" />
          导出当前池
        </button>
      </div>
      <div className="mt-3 border border-slate-800 bg-[#080b13] p-2">
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10px] text-slate-500">观察池</span>
          <button
            type="button"
            onClick={() => {
              setSelectedCollectionId(null);
              setComposerOpen(false);
            }}
            className={`border px-2 py-1 text-[10px] ${selectedCollectionId == null ? "border-cyan-500 bg-cyan-950 text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-100"}`}
          >
            {boardQuery.data?.defaultCollectionName ?? "默认研究观察池"}
          </button>
          {boardQuery.data?.collections.map(collection => (
            <button
              key={collection.id}
              type="button"
              onClick={() => {
                setSelectedCollectionId(collection.id);
                setComposerOpen(false);
              }}
              className={`border px-2 py-1 text-[10px] ${selectedCollectionId === collection.id ? "border-violet-500 bg-violet-950 text-violet-50" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-violet-100"}`}
            >
              {collection.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setEditingCollection(false);
              setDraftName("");
              setComposerOpen(open => !open);
            }}
            className="ml-1 inline-flex items-center gap-1 border border-cyan-800 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-950/40"
          >
            <FolderPlus className="h-3 w-3" />
            新建池
          </button>
          {selectedCollection && (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingCollection(true);
                  setDraftName(selectedCollection.name);
                  setComposerOpen(true);
                }}
                className="inline-flex items-center gap-1 border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:text-cyan-100"
              >
                <Pencil className="h-3 w-3" />
                重命名
              </button>
              <button
                type="button"
                disabled={deleteCollection.isPending}
                onClick={() =>
                  deleteArmed
                    ? deleteCollection.mutate({ id: selectedCollection.id })
                    : setDeleteArmed(true)
                }
                className="inline-flex items-center gap-1 border border-rose-900/70 px-2 py-1 text-[10px] text-rose-200 hover:bg-rose-950/40"
              >
                <Trash2 className="h-3 w-3" />
                {deleteArmed ? "确认删除并回退条目" : "删除池"}
              </button>
            </>
          )}
        </div>
        {composerOpen && (
          <div className="mt-2 flex flex-wrap gap-2">
            <input
              aria-label="观察池名称"
              value={draftName}
              onChange={event => setDraftName(event.target.value)}
              placeholder={editingCollection ? "观察池名称" : "新观察池名称"}
              maxLength={64}
              className="min-w-48 flex-1 border border-slate-700 bg-[#0d1220] px-2 py-1 text-xs text-slate-100 placeholder:text-slate-600"
            />
            <button
              type="button"
              disabled={
                createCollection.isPending || renameCollection.isPending
              }
              onClick={submitCollection}
              className="border border-cyan-700 bg-cyan-950 px-2 py-1 text-[10px] text-cyan-50 disabled:opacity-50"
            >
              {editingCollection ? "保存名称" : "创建并切换"}
            </button>
          </div>
        )}
        {deleteArmed && (
          <p className="mt-2 text-[10px] leading-4 text-amber-100">
            确认后仅删除此命名观察池；其中保存的研究条目不会删除，而会回到默认研究观察池。
          </p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            addItem.mutate({
              itemType: "stock",
              symbol,
              displayName: `${symbol} 股票研究观察`,
              collectionId: selectedCollectionId,
            })
          }
          disabled={mutationPending}
          className="inline-flex items-center gap-1 border border-cyan-700 bg-cyan-950/30 px-2 py-1 text-[10px] text-cyan-100 hover:bg-cyan-900/50 disabled:opacity-50"
        >
          <BookmarkPlus className="h-3 w-3" />
          添加 {symbol} 股票
        </button>
        <button
          type="button"
          onClick={() =>
            addItem.mutate({
              itemType: "nceo_model",
              symbol,
              displayName: `${symbol} ${leg === "call" ? "Call" : "Put"} 模型观察`,
              optionSide: leg,
              expiryDays: 30,
              collectionId: selectedCollectionId,
            })
          }
          disabled={mutationPending}
          className="inline-flex items-center gap-1 border border-violet-700 bg-violet-950/40 px-2 py-1 text-[10px] text-violet-100 hover:bg-violet-900/60 disabled:opacity-50"
        >
          <BookmarkPlus className="h-3 w-3" />
          添加当前 NCEO 模型
        </button>
      </div>
      {feedback && (
        <p
          role="status"
          className="mt-2 border border-cyan-900/60 bg-cyan-950/20 p-2 text-[10px] text-cyan-100"
        >
          {feedback}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-800 pt-2">
        <span className="text-[10px] text-slate-500">
          {currentCollectionName}布局列数
        </span>
        {(["1", "2", "3", "4"] as const).map(count => (
          <button
            key={count}
            type="button"
            disabled={saveLayout.isPending}
            onClick={() => persistLayout({ gridColumns: count })}
            className={`border px-2 py-1 text-[10px] ${gridColumns === count ? "border-cyan-500 bg-cyan-950 text-cyan-50" : "border-slate-700 bg-slate-900 text-slate-400 hover:text-cyan-100"}`}
          >
            {count} 列
          </button>
        ))}
        <span className="ml-1 text-[10px] text-slate-500">显示字段</span>
        {columns.map(column => (
          <button
            key={column}
            type="button"
            disabled={saveLayout.isPending}
            onClick={() => {
              const next = visibleColumns.includes(column)
                ? visibleColumns.filter(item => item !== column)
                : [...visibleColumns, column];
              if (next.length >= 2) persistLayout({ visibleColumns: next });
            }}
            className={`border px-2 py-1 text-[10px] ${visibleColumns.includes(column) ? "border-cyan-700 text-cyan-100" : "border-slate-700 text-slate-600"}`}
          >
            {labels[column]}
          </button>
        ))}
      </div>
      {boardQuery.isLoading ? (
        <div className="mt-3 grid h-24 place-items-center border border-dashed border-slate-700 text-xs text-slate-500">
          正在读取登录用户的研究观察池…
        </div>
      ) : boardQuery.isError || boardQuery.data?.status === "unavailable" ? (
        <div className="mt-3 border border-amber-900/70 bg-amber-950/20 p-3 text-xs text-amber-100">
          {boardQuery.data?.sourceBoundary ??
            "观察池当前不可用；不会使用浏览器缓存伪造已保存布局。"}
        </div>
      ) : !currentItems.length ? (
        <div className="mt-3 border border-dashed border-slate-700 p-3 text-xs text-slate-500">
          {currentCollectionName}尚未保存研究观察条目。可添加上方股票或当前 NCEO
          模型合约；此为空状态，不自动生成自选池。
        </div>
      ) : (
        <div
          className={`mt-3 grid gap-px bg-slate-800 ${gridClass[gridColumns]}`}
        >
          {boardPanes.map((pane, paneIndex) => (
            <div key={paneIndex} className="overflow-x-auto bg-[#080b13]">
              <table className="w-full min-w-[520px] text-left text-[10px]">
                <thead className="text-slate-500">
                  <tr>
                    {visibleColumns.map(column => (
                      <th
                        key={column}
                        className="border-b border-slate-800 px-2 py-1.5"
                      >
                        {labels[column]}
                      </th>
                    ))}
                    <th className="border-b border-slate-800 px-2 py-1.5 text-right">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pane.map(item => {
                    const index = currentItems.findIndex(
                      current => current.id === item.id
                    );
                    return (
                      <tr
                        key={item.id}
                        className="border-b border-slate-800/70 align-top"
                      >
                        {visibleColumns.map(column => (
                          <td key={column} className="px-2 py-2 text-slate-400">
                            {column === "symbol" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  item.itemType === "stock"
                                    ? onSelectStock(item.symbol)
                                    : onOpenNceo(item.symbol)
                                }
                                className="text-left"
                              >
                                <span className="block font-mono text-cyan-100">
                                  {item.symbol}
                                </span>
                                <span className="block max-w-40 truncate">
                                  {item.displayName}
                                </span>
                                <span className="block text-[9px] text-cyan-400">
                                  {item.itemType === "stock"
                                    ? "在驾驶舱中查看"
                                    : "在 NCEO 中查看"}
                                </span>
                              </button>
                            ) : column === "kind" ? (
                              <>
                                类型：
                                {item.itemType === "stock"
                                  ? "股票研究"
                                  : "NCEO 模型"}
                              </>
                            ) : column === "modelStatus" ? (
                              <>
                                模型：
                                {item.itemType === "nceo_model"
                                  ? `${item.optionSide === "call" ? "Call" : "Put"} ${item.expiryDays ?? "—"}D`
                                  : "不适用"}
                              </>
                            ) : column === "sourceStatus" ? (
                              <>
                                刷新：
                                {item.itemType === "stock"
                                  ? "打开时重读日频"
                                  : "打开时重算模型"}
                              </>
                            ) : (
                              <>
                                保存：
                                {new Date(item.updatedAt).toLocaleDateString()}
                              </>
                            )}
                          </td>
                        ))}
                        <td className="px-2 py-2">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              aria-label={`上移 ${item.displayName}`}
                              disabled={index === 0 || reorderItems.isPending}
                              onClick={() => moveItem(item.id, -1)}
                              className="text-slate-500 hover:text-cyan-200 disabled:opacity-30"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`下移 ${item.displayName}`}
                              disabled={
                                index === currentItems.length - 1 ||
                                reorderItems.isPending
                              }
                              onClick={() => moveItem(item.id, 1)}
                              className="text-slate-500 hover:text-cyan-200 disabled:opacity-30"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              aria-label={`移除 ${item.displayName}`}
                              onClick={() => removeItem.mutate({ id: item.id })}
                              disabled={removeItem.isPending}
                              className="text-slate-500 hover:text-rose-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-[9px] text-slate-600">
        {boardQuery.data?.sourceBoundary}
      </p>
    </section>
  );
}
