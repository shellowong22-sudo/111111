# 指数模块原内容保护审计基线

## 保护原则

本文件锁定指数模块的原始路由壳、23 个独立原面板及两份原 CIX 聚合面板文件。后续开发只能在原工作区渲染完成后追加独立研究容器；不得调整原菜单、字段、顺序、窗口标识、原面板文件或既有交互。

## 原始窗口路由

`IndexHub.tsx` 的原始 `PANEL_MAP` 顺序为：SECF、HELP_INDX、WEI、WEIF、WBIX、GMM、IN、INP、CIX、CIXB、AGG、FDFD、OTHER_INDEX、RRG、WT、CIXN、CIXS、CIXR、CIXC、CIXX、CIXI、INDEX_DERIV、BBG。

## SHA-256 指纹

| 文件 | SHA-256 |
| --- | --- |
| `client/src/pages/IndexHub.tsx` | `ef283cbbc4f69df311aefceff6f51cb19fbd88c8e62b6c5c2a8542659c176159` |
| `AGGPanel.tsx` | `040951199edfd5ce3af3c6ffe86341beb883d0f19915b2d0b577ee529412a68c` |
| `BBGIndexPanel.tsx` | `2d89e42a3e65de951cec68b68f24b520fbad8ed8646a190e1a46113a077a474b` |
| `CIXBPanel.tsx` | `005475d7ac75fa6ddd850f60b9303350e19a67d18eb432b1276b90d4326d47bb` |
| `CIXCPanel.tsx` | `da2995fac7cdd254b9304b147e72a96433fb3af1d8dfd896a4a4a1899d4a34a2` |
| `CIXIPanel.tsx` | `2bf7bd6cfa16f874d5d91a9bcc6b851a8e14bfb99e70434528e92f4b276ea3e5` |
| `CIXNPanel.tsx` | `65ff2db25860d79625f1019e4e507b1133141f08a6325b3e01043044db951fd5` |
| `CIXPanel.tsx` | `8b656081f5ed6fd8591b0f4ce97298046134c327c3bbee4a2c12a1b9cc8d4dad` |
| `CIXRPanel.tsx` | `28a03898d77cb3fac318832d1777454128c592d5e7e7e731f3983d4bb52018b1` |
| `CIXSPanel.tsx` | `65791e0cf01e351c9a1918c25e09f9950175b90bdf7c8ce0ed273c14fa74813b` |
| `CIXXPanel.tsx` | `5881a0e64b5a2f5fc584a0c9b7c169143e134e22b11682a08303ba4ef72d1b6f` |
| `FDFDPanel.tsx` | `9c7a255f37048bb7842de92a7eabf44f2cf616394b4940c260b56eefa7af8c8e` |
| `GMMPanel.tsx` | `fbf2990d9e6d090d77b480e9e5cfa16c3ad2b183a2ebfa08b4352271e20626ca` |
| `HELPINDXPanel.tsx` | `5f2e6a905b065dea27116afa41905d2d5d14b212f730ba7abbb433dba427146c` |
| `INPPanel.tsx` | `4c6051ecf4906af9defe22348b0365ae0ed3403d68f389476659e77feed41fbf` |
| `INPanel.tsx` | `1b87e32e508f31809d051110d4b251cdd6e6faa6c105cb592455b07f14ccaa11` |
| `IndexDerivativesPanel.tsx` | `705a2990fb2ca4c8b1e6dccf407052661d52aac749d68a0e44fe2c654538a095` |
| `OtherIndexPanel.tsx` | `6d68a85686d330391527fad3f151435f81bdff044db4541b55aa52071614d86e` |
| `RRGPanel.tsx` | `8e5e2334f1dc6987f3b948a7478f5db540659852ec8c4bb943ed9ffc0d09d7b5` |
| `SECFPanel.tsx` | `8a64adde431332dbab0f4130ec8cb0fc03f49196533466bbae357b8474bb854d` |
| `WBIXPanel.tsx` | `c2f418a4f3fcc9ee96ab871ae48e06694eb05e03652b323799b8a6bf23873839` |
| `WEIFPanel.tsx` | `4a062103f5f15463d3a7af7aa99ffd5a4dea16db9b93ed9241ea09e1e27f8307` |
| `WEIPanel.tsx` | `f2d4f37338ebf7810a1c856cf21e7d8baeb1e925e952ae5524e5ddefe4ca52f3` |
| `WTPanel.tsx` | `ed5d5676499e464cfc3d40b16a9a986ed91f57cc5440a7a766b64ac9138d8645` |
| `client/src/components/CIXEditors.tsx` | `ffaa178f39eeb5740625bbfcf24fef2ed0a09c432f04300efe7e8bf768e07be5` |
| `client/src/components/CIXPanel.tsx` | `56529b3c25283893225dbf729bfcae09b0a89bdf3b8204e535084186459e5b09` |

## 追加边界

所有新增研究只允许由未纳入上述指纹的独立容器、独立研究层和新增服务端路由提供。核心阅读路径应在终端内完成；免费公开数据不可用时显示可理解的真实空状态，不以静态示例、随机值或离站链接替代。
