# Zhongwen data — third-party attribution

The JSON files in this directory are derived from third-party reference
datasets. They are committed snapshots; regenerate them with
`pnpm tsx scripts/build-zhongwen-data.ts` (see that file for primary URLs).

## cedict.json — CC-CEDICT

CC-CEDICT is a community-maintained Chinese-English dictionary distributed
under **Creative Commons Attribution-ShareAlike 4.0 International**
(<https://creativecommons.org/licenses/by-sa/4.0/>).

- Project home: <https://www.mdbg.net/chinese/dictionary?page=cc-cedict>
- Direct: <https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz>
- Copyright © MDBG and contributors.

Per the CC-BY-SA 4.0 ShareAlike clause, the `cedict.json` slice in this repo
is itself made available under the same CC-BY-SA 4.0 license. The remainder
of this repo is not.

## frequency.json — BLCU BCC corpus

The build script targets the **BLCU BCC corpus** word frequency list (a
15-billion-character balanced Chinese corpus from Beijing Language and
Culture University). Citation:

> Xun Endong, Rao Gaoqi, Xiao Xiaoyue, and Zang Jiaojiao. The construction
> of the BCC corpus in the age of big data. _Corpus Linguistics_, 2016.

- Corpus home: <http://bcc.blcu.edu.cn/>
- Frequency lists (zip): <http://bcc.blcu.edu.cn/downloads/resources/BCC_LEX_Zh.zip>

The BCC frequency lists are published by BLCU for academic and personal use;
maintainers running the build script should review the BLCU site for the
current terms before redistributing the regenerated `frequency.json`.

## hsk.json — HSK 2.0 vocabulary

The HSK (Hanyu Shuiping Kaoshi) syllabus levels and word lists are published
by Hanban / Chinese Testing International. The HSK levels themselves are
factual reference data. The build script joins the HSK 2.0 (level 1 + 2)
word list compiled by **clem109/hsk-vocabulary** (MIT-licensed) at
<https://github.com/clem109/hsk-vocabulary> with the current CC-CEDICT pinyin
when run.

## Snapshot caveat

The committed snapshots in this directory are smaller than the ~6000-entry
target shape that `scripts/build-zhongwen-data.ts` produces from a full
network run. They exist so that the lazy loaders have something deterministic
to import; refresh them by running the build script in an environment that
can reach mdbg.net and bcc.blcu.edu.cn.
