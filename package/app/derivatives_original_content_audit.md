# 衍生品原内容保护审计基线

本记录建立于 2026-08-21。原始菜单、原窗口、原字段、原交互、原路由顺序与原面板文件均不得改写；后续研究能力仅由外层保留容器在原 children 完整渲染之后追加。

| 原始文件 | SHA-256 | 原始入口/职责 |
|---|---|---|
| `DerivativesMenu.tsx` | `b1c94c89f492fcc2e6292894817a4c9954cb4db1808bb79257252f9010d77638` | 30 项衍生品菜单、顺序和层级 |
| `OVPanel.tsx` | `d286352c1d6164acbe4a7bca31cfe8567225c0159e8d8fb1d4c398e8fc84bc19` | OV 期权损益分析 |
| `OILSPanel.tsx` | `0f0156d248e5982dcfc942fbb721211ad7487ee0ed6345058d005740fb664fc1` | OILS 石油冲击 |
| `FuturesOptionsMonitor.tsx` | `b9c5ad8a0f853ba3b5f94f92e6af139470dd2a7ab75c16fc5feaf3ebbf908511` | FOM 期货与期权行情监控 |
| `WBFAdvanced.tsx` | `b2b3444fbffa0072df2963394b433b9377d54d7a9648283ebfa1dba039d459e8` | WBF AI 全球债券期货增强 |
| `CreditMonitorAdvanced.tsx` | `0c1aabbb0c057865c97f2f9ecddf960e46f2ad7f88aa60f70ab18ce3c1c01e43` | 信用监控综合面板 |
| `CDSWPanel.tsx` | `3334e4fe9b30e5f39c69cfb2dae34499505202cec076ee77d6ab2a5f4c978f76` | CDSW CDS 估值 |
| `VCAPanel.tsx` | `33056daf6e3a0f1416abeb17844a0719d9eedc4d873ce0df7fefebdfd75a1764` | VCA 波动率与相关系数分析 |
| `MARSPanel.tsx` | `f289c8fa22024945975f77e4af1d6e6d104391a791f6efc14d5fcd499285aa8c` | MARS 多资产风险系统 |
| `OVCVPanel.tsx` | `d2f0eb319f01667ff4ed8625c2b9ae411db44cb0f4a22253f6d527677bf4a189` | OVCV 可转换债券估价 |
| `DLIBPanel.tsx` | `7787f97e8a3266dba01fe2ea72acee4def98af0d3fe851cfad581404f19848ad` | DLIB 衍生品库 |
| `MOSOPanel.tsx` | `08eb5e4f57b85cecb449cb7cd6d89a307deb8e2515dd1df2b46e2ee481e56ac2` | MOSO 交易最活跃期权 |
| `OVMLPanel.tsx` | `6015896691e82e79b2f430e2dcf728efc977be51e33e4be4c569a332153a2ba7` | OVML 外汇/商品期权定价 |

`Terminal.tsx` 的 `moduleId === 'derivatives'` 原始映射也作为结构保护对象：后续只允许以独立 `DerivativesPreservedModule` 包裹其既有 component，不改变映射项、标题、顺序、键或原 child。
