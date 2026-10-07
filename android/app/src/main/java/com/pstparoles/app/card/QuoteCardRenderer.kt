package com.pstparoles.app.card

import android.content.ContentValues
import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.annotation.RequiresApi
import androidx.core.content.res.ResourcesCompat
import androidx.core.graphics.ColorUtils
import androidx.core.graphics.drawable.toBitmap
import coil.ImageLoader
import coil.request.ImageRequest
import coil.request.SuccessResult
import com.pstparoles.app.R
import com.pstparoles.app.core.cardFileName
import com.pstparoles.app.core.hueOf
import com.pstparoles.app.core.initials
import com.pstparoles.app.core.wrapWords
import com.pstparoles.app.data.Song
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File

/** Image 1080×1350 (format portrait des réseaux sociaux) : pochette, titre, citation, logo. */
object QuoteCardRenderer {
    private const val W = 1080
    private const val H = 1350
    private const val PAD = 88f

    suspend fun render(context: Context, lines: List<String>, song: Song): File {
        val cover = loadCover(context, song.thumbnail)
        return withContext(Dispatchers.Default) {
            val bitmap = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
            draw(Canvas(bitmap), context, lines, song, cover)

            val dir = File(context.cacheDir, "cards").apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() } // une seule carte à la fois suffit
            val file = File(dir, cardFileName(song.artist, song.title))
            file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
            bitmap.recycle()
            file
        }
    }

    /** Copie la carte dans Images/pstparoles (pas de permission nécessaire depuis Android 10). */
    @RequiresApi(Build.VERSION_CODES.Q)
    suspend fun saveToGallery(context: Context, file: File): Uri? = withContext(Dispatchers.IO) {
        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, file.name)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/pstparoles")
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return@withContext null
        resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }
        uri
    }

    private suspend fun loadCover(context: Context, url: String?): Bitmap? {
        if (url.isNullOrBlank()) return null
        val request = ImageRequest.Builder(context).data(url).allowHardware(false).build()
        val result = ImageLoader(context).execute(request)
        return (result as? SuccessResult)?.drawable?.toBitmap()
    }

    private fun font(context: Context, res: Int, weight: Int): Typeface {
        val base = ResourcesCompat.getFont(context, res) ?: Typeface.DEFAULT
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) Typeface.create(base, weight, false) else base
    }

    private fun draw(canvas: Canvas, context: Context, lines: List<String>, song: Song, cover: Bitmap?) {
        val serif = font(context, R.font.instrument_serif, 400)
        val sans = font(context, R.font.space_grotesk, 500)
        val mono = font(context, R.font.jetbrains_mono, 400)
        val tint = ColorUtils.HSLToColor(floatArrayOf(hueOf(song.title + song.artist).toFloat(), 0.7f, 0.62f))
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)

        // --- fond + halo, comme sur le site ---
        canvas.drawColor(Color.rgb(10, 10, 12))
        paint.shader = RadialGradient(
            W / 2f, 90f, 760f,
            ColorUtils.setAlphaComponent(tint, 72), Color.TRANSPARENT, Shader.TileMode.CLAMP,
        )
        canvas.drawRect(0f, 0f, W.toFloat(), 900f, paint)
        paint.shader = null

        // --- pochette ---
        val coverSize = 150f
        val coverY = 96f
        val coverRect = RectF(PAD, coverY, PAD + coverSize, coverY + coverSize)
        canvas.save()
        canvas.clipPath(Path().apply { addRoundRect(coverRect, 22f, 22f, Path.Direction.CW) })
        if (cover != null) {
            // équivalent de object-fit: cover
            val scale = maxOf(coverSize / cover.width, coverSize / cover.height)
            val dw = cover.width * scale
            val dh = cover.height * scale
            val dst = RectF(
                PAD + (coverSize - dw) / 2, coverY + (coverSize - dh) / 2,
                PAD + (coverSize + dw) / 2, coverY + (coverSize + dh) / 2,
            )
            canvas.drawBitmap(cover, null, dst, Paint(Paint.FILTER_BITMAP_FLAG))
        } else {
            paint.shader = LinearGradient(
                coverRect.left, coverRect.top, coverRect.right, coverRect.bottom,
                tint, Color.rgb(10, 10, 12), Shader.TileMode.CLAMP,
            )
            canvas.drawRect(coverRect, paint)
            paint.shader = null
            paint.color = Color.argb(153, 0, 0, 0)
            paint.typeface = serif
            paint.textSize = 62f
            paint.textAlign = Paint.Align.CENTER
            val fm = paint.fontMetrics
            canvas.drawText(initials(song.artist), coverRect.centerX(), coverRect.centerY() - (fm.ascent + fm.descent) / 2, paint)
        }
        canvas.restore()

        // --- titre + artiste ---
        paint.textAlign = Paint.Align.LEFT
        val textX = PAD + coverSize + 34f
        val maxMetaW = W - textX - PAD

        paint.color = Color.rgb(242, 240, 236)
        paint.typeface = serif
        paint.textSize = 48f
        val titleLines = wrapWords(song.title, maxMetaW) { paint.measureText(it) }.take(2)
        titleLines.forEachIndexed { i, l -> canvas.drawText(l, textX, coverY + 58f + i * 54f, paint) }

        paint.color = Color.rgb(142, 141, 152)
        paint.typeface = sans
        paint.textSize = 28f
        val artistLine = wrapWords(song.displayArtist ?: song.artist, maxMetaW) { paint.measureText(it) }.first()
        canvas.drawText(artistLine, textX, coverY + 62f + titleLines.size * 54f, paint)

        // --- citation, centrée et dimensionnée pour tenir ---
        val quoteTop = 360f
        val quoteBottom = H - 190f
        val maxQuoteW = W - PAD * 2
        val maxQuoteH = quoteBottom - quoteTop

        paint.typeface = serif
        var fontSize = 66f
        var wrapped: List<String> = emptyList()
        while (fontSize >= 28f) {
            paint.textSize = fontSize
            wrapped = lines.flatMap { line -> wrapWords(line, maxQuoteW) { paint.measureText(it) } }
            if (wrapped.size * fontSize * 1.42f <= maxQuoteH) break
            fontSize -= 2f
        }
        val lineHeight = fontSize * 1.42f
        var y = quoteTop + (maxQuoteH - wrapped.size * lineHeight) / 2 + fontSize

        // petit trait d'accent au-dessus de la citation
        paint.color = tint
        canvas.drawRect(PAD, y - fontSize - 52f, PAD + 72f, y - fontSize - 47f, paint)

        paint.color = Color.rgb(242, 240, 236)
        paint.textSize = fontSize
        for (l in wrapped) {
            canvas.drawText(l, PAD, y, paint)
            y += lineHeight
        }

        // --- pied de carte ---
        paint.color = Color.argb(26, 255, 255, 255)
        canvas.drawRect(PAD, H - 132f, W - PAD, H - 131f, paint)

        paint.color = Color.rgb(99, 98, 108)
        paint.typeface = mono
        paint.textSize = 26f
        canvas.drawText("pstparoles", PAD, H - 78f, paint)
    }
}
