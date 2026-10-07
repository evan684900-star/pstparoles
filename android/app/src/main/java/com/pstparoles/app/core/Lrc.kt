package com.pstparoles.app.core

/** Une ligne horodatée d'un fichier LRC. */
data class LrcLine(val timeMs: Long, val text: String)

private val STAMP = Regex("""\[(\d+):(\d{2})(?:[.:](\d{1,3}))?\]""")
private val ANY_TAG = Regex("""\[[^\]]*\]""")

/**
 * Format LRC : `[mm:ss.cc] texte`, avec plusieurs horodatages possibles par
 * ligne (refrain répété). Les lignes sans horodatage (métadonnées) sont ignorées.
 */
fun parseLrc(lrc: String?): List<LrcLine> {
    if (lrc.isNullOrBlank()) return emptyList()
    val out = mutableListOf<LrcLine>()

    for (raw in lrc.split('\n')) {
        val stamps = STAMP.findAll(raw).toList()
        if (stamps.isEmpty()) continue

        val text = raw.replace(ANY_TAG, "").trim()
        for (m in stamps) {
            val minutes = m.groupValues[1].toLong()
            val seconds = m.groupValues[2].toLong()
            val fractionRaw = m.groupValues[3]
            val fraction = if (fractionRaw.isEmpty()) 0L else fractionRaw.padEnd(3, '0').toLong()
            out += LrcLine(minutes * 60_000 + seconds * 1_000 + fraction, text)
        }
    }

    return out.sortedBy { it.timeMs }
}

/**
 * Indice de la ligne en cours à la position [posMs] (recherche dichotomique,
 * robuste aux sauts dans le morceau), ou -1 avant la première ligne.
 */
fun findLineIndexAt(lines: List<LrcLine>, posMs: Long): Int {
    var low = 0
    var high = lines.size - 1
    var found = -1
    while (low <= high) {
        val mid = (low + high) ushr 1
        if (lines[mid].timeMs <= posMs) {
            found = mid
            low = mid + 1
        } else {
            high = mid - 1
        }
    }
    return found
}
