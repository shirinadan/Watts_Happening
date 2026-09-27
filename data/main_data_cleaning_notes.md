# main_data.csv 清理说明

仅整理本地数据，未调用 API、查询地区或开发后续功能。

- 原文件：main_data.csv，保持不变。
- 输出：main_data_cleaned.csv，UTF-8 BOM，逗号分隔。
- 输入与输出均为 **1,083 条变电站记录**；源字段 10 列，输出增加 source_csv_row、quality_flags，共 12 列。
- 无完全重复记录，因此未删除任何行；保留原顺序。
- 这不是一行一个独立项目的项目目录，不能用行数作为项目总数。

## 已完成的清理

- 统一英文 snake_case 表头。
- 去除 458 个单元格的首尾空白，其中 458 个纯空白单元格转为空值。
- 电压列的 155 个 Unknown 转为空值；未把缺失值填成 0。
- 11 个单元格做 Unicode NFKC 规范化（不换行空格、fi 连字），5 个单元格合并连续空白；保留名称内容及破折号。
- 493 条记录的原有字段发生上述规范化或确定性修正。
- S-0984: 根据已有 TX 补全 Texas
- S-0985: 根据已有 TX 补全 Texas
- S-0987: 根据已有 TX 补全 Texas
- S-1021: 交换州缩写与州名，得到 OK / Oklahoma

## 保留并标记的问题

quality_flags 用 | 分隔，可有多个标记；共 492 条记录有至少一个标记（含缺失值提示），各项计数不可直接相加。空标记仅表示未触发这些检查，不表示已核实来源。

| 标记 | 行数 | 含义 |
| --- | ---: | --- |
| missing_current_max_voltage | 68 | 现有最大电压缺失 |
| missing_current_min_voltage | 482 | 现有最小电压缺失 |
| voltage_value_review | 4 | 选出的电压数值待核实，仅提示，不判定为错误 |
| missing_planned_project | 26 | 关联计划项目名称缺失 |
| zero_planned_project_voltage | 7 | 源计划项目电压为 0，含义未确认，原值保留 |
| zero_current_max_voltage | 293 | 源最大电压为 0，含义未确认，原值保留 |
| current_min_exceeds_max | 1 | 现有最小电压大于最大电压，原值保留 |
| duplicate_substation_id | 2 | 源变电站编号重复，不能直接作为唯一键 |
| missing_state | 17 | 州/省信息缺失，未通过坐标推断 |

- S-0918 的两条记录分别是 East Palmerton 和 Columbia，名称和坐标不同，全部保留。未猜测新编号；本次文件可用 source_csv_row 唯一定位记录。
- S-0875（Capistrano）最大电压 115、最小电压 138，未交换或改写。
- 选出的电压复核项：S-0006: current_max_voltage_kv=232; planned_project_voltage_kv=230；S-0441: current_max_voltage_kv=230; planned_project_voltage_kv=229；S-0592: current_max_voltage_kv=360; planned_project_voltage_kv=525；S-0980: current_max_voltage_kv=348; planned_project_voltage_kv=0。这些值可能合法，未按常见电压值替换。
- 5 条加拿大省份记录（SK 1、QC 3、ON 1）保留。
- 所有经纬度均可解析为有限数值且在全球有效范围内；这只验证格式和范围，没有核实设施位置。坐标未更改、未舍入。
- 同名站点、同项目下多个站点、一个站点关联多个项目均保留，未按名称合并。
- 文件未提供公司所有者、施工起止日期或费用字段，本次未补造这些字段。

## 字段对应

| 输出字段 | 原字段 | 含义 |
| --- | --- | --- |
| substation_id | Substation ID | 源变电站编号，保留前导零；存在重复编号 |
| substation_name | Substation name | 变电站名称 |
| state_code | State (abbrv.) | 州或加拿大省缩写 |
| state_name | State | 州或加拿大省全名 |
| latitude | Latitude | 纬度，十进制度，精度按源文件保留 |
| longitude | Longitude | 经度，十进制度，精度按源文件保留 |
| current_max_voltage_kv | Current maximum voltage (kV) | 现有最大电压，kV |
| current_min_voltage_kv | Current minimum voltage (kV) | 现有最小电压，kV |
| planned_project | Planned project | 源关联项目名称文本；一格可能含多个项目，未擅自拆分 |
| planned_project_voltage_kv | Planned project voltage | 计划项目电压，kV（按同表电压列的单位约定） |
| source_csv_row | 新增 | 原 CSV 行号，表头为第 1 行；仅在本次源文件内唯一 |
| quality_flags | 新增 | 数据质量与缺失值提示，多个标记用竖线分隔 |

CSV 本身没有强类型。读取时把经纬度、电压和 source_csv_row 转成数值，空字段视为缺失；substation_id 保持字符串。电压 0 虽保留，但使用前需结合标记确认含义。

原文件 SHA-256：`4870375434f66eacf593562527ee65a1c1dd2e67b78072a558b4ec75fb2fe232`
