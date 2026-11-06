package de.kryptotagebuch.charts;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.DashPathEffect;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import org.json.JSONObject;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public final class ChartView extends View {
    private static final int GREEN=Color.rgb(52,211,153), RED=Color.rgb(251,113,133), BLUE=Color.rgb(56,189,248);
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final ScaleGestureDetector scale;
    private ChartData data;
    private int count=64, offset;
    private float lastX, dragRemainder;
    private boolean scaled;
    private long touchTime;
    private String frame;
    public ChartView(Context context) {
        super(context);
        setBackgroundColor(Color.rgb(2,6,23));
        scale=new ScaleGestureDetector(context,new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override public boolean onScale(ScaleGestureDetector detector) { scaled=true;zoom(detector.getScaleFactor());return true; }
        });
    }
    public void setMarketData(JSONObject market,String timeframe,JSONObject plan) {
        data=new ChartData(market,timeframe,plan);frame=timeframe;resetZoom();
    }
    public void zoom(float factor) {
        if(data==null||data.candles.isEmpty()) return;
        count=Math.max(Math.min(20,data.candles.size()),Math.min(data.candles.size(),Math.round(count/factor)));
        offset=Math.min(offset,Math.max(0,data.candles.size()-count));invalidate();
    }
    public void resetZoom() { count=Math.min(64,data==null?0:data.candles.size());offset=0;invalidate(); }
    @Override public boolean onTouchEvent(MotionEvent event) {
        if(data==null||data.candles.size()<2) return false;
        scale.onTouchEvent(event);
        if(event.getActionMasked()==MotionEvent.ACTION_DOWN) {
            getParent().requestDisallowInterceptTouchEvent(true);lastX=event.getX();scaled=false;dragRemainder=0;
            if(event.getEventTime()-touchTime<300) resetZoom();touchTime=event.getEventTime();
        } else if(event.getActionMasked()==MotionEvent.ACTION_MOVE&&!scale.isInProgress()&&!scaled) {
            dragRemainder+=(event.getX()-lastX)/Math.max(1,(getWidth()-dp(84))/Math.max(1,count));
            int move=(int)dragRemainder;
            offset=Math.max(0,Math.min(Math.max(0,data.candles.size()-count),offset+move));dragRemainder-=move;invalidate();
        } else if(event.getActionMasked()==MotionEvent.ACTION_UP||event.getActionMasked()==MotionEvent.ACTION_CANCEL) {
            getParent().requestDisallowInterceptTouchEvent(false);performClick();
        }
        lastX=event.getX();return true;
    }
    @Override public boolean performClick() {super.performClick();return true;}
    @Override protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float left=dp(10),right=getWidth()-dp(84),top=dp(36),bottom=getHeight()-dp(30);
        paint.setTextSize(dp(11));paint.setColor(Color.rgb(148,163,184));
        if(data==null||data.candles.size()<2||right<=left) {canvas.drawText("Keine Kursdaten für diese Zeitebene",left,dp(28),paint);return;}
        int end=data.candles.size()-offset,start=Math.max(0,end-count);
        double[] range=data.range(start,end);double min=range[0],max=range[1];
        canvas.drawText((end-start)+" Kerzen · "+(data.points.isEmpty()?"Wellenanalyse fehlt":"Wellenverlauf"),left,dp(17),paint);
        for(int i=0;i<5;i++) {
            float py=top+(bottom-top)*i/4;
            paint.setColor(Color.rgb(30,41,59));paint.setStrokeWidth(dp(1));canvas.drawLine(left,py,right,py,paint);
            paint.setColor(Color.rgb(148,163,184));canvas.drawText(MainActivity.formatPrice(max-(max-min)*i/4),right+dp(5),py+dp(4),paint);
        }
        float step=(right-left)/(end-start);
        for(int i=start;i<end;i++) {
            JSONObject c=data.candles.get(i);float x=left+step*(i-start+.5f);
            paint.setColor(c.optDouble("close")>=c.optDouble("open")?GREEN:RED);paint.setStrokeWidth(dp(1));
            canvas.drawLine(x,y(c.optDouble("high"),min,max,top,bottom),x,y(c.optDouble("low"),min,max,top,bottom),paint);
            float bt=y(Math.max(c.optDouble("open"),c.optDouble("close")),min,max,top,bottom);
            float bb=y(Math.min(c.optDouble("open"),c.optDouble("close")),min,max,top,bottom),width=Math.max(dp(1),step*.6f);
            canvas.drawRect(x-width/2,bt,x+width/2,Math.max(bt+dp(1),bb),paint);
        }
        // Offscreen levels stay in the description; they never flatten the candles.
        for(JSONObject level:data.levels) line(canvas,level.optDouble("price"),"Fib "+level.optString("ratio"),BLUE,min,max,left,right,top,bottom);
        if(ChartData.positive(data.invalidation)) line(canvas,data.invalidation,"Invalidierung",RED,min,max,left,right,top,bottom);
        double current=data.candles.get(end-1).optDouble("close");
        paint.setPathEffect(new DashPathEffect(new float[]{dp(4),dp(4)},0));
        line(canvas,current,"Kurs "+MainActivity.formatPrice(current),Color.rgb(148,163,184),min,max,left,right,top,bottom);paint.setPathEffect(null);
        long first=ChartData.time(data.candles.get(start)),last=ChartData.time(data.candles.get(end-1));
        float prevX=0,prevY=0;boolean previous=false;int clip=canvas.save();canvas.clipRect(left,top,right,bottom);
        for(JSONObject point:data.points) {
            long t=ChartData.time(point);if(t<first||t>last) {previous=false;continue;}
            int index=start;while(index<end-1&&ChartData.time(data.candles.get(index+1))<=t) index++;
            float x=left+step*(index-start+.5f),py=y(point.optDouble("price"),min,max,top,bottom);
            paint.setColor(BLUE);paint.setStrokeWidth(dp(2));if(previous) canvas.drawLine(prevX,prevY,x,py,paint);canvas.drawCircle(x,py,dp(3),paint);
            paint.setTextSize(dp(13));paint.setFakeBoldText(true);String label=point.optString("label");
            float ly=Math.max(top+dp(14),Math.min(bottom-dp(4),py+(index%2==0?-dp(12):dp(20))));
            float lx=Math.max(left,Math.min(right-paint.measureText(label)-dp(4),x-dp(5)));
            paint.setColor(Color.rgb(2,6,23));canvas.drawRect(lx-dp(3),ly-dp(14),lx+paint.measureText(label)+dp(3),ly+dp(3),paint);
            paint.setColor(BLUE);canvas.drawText(label,lx,ly,paint);paint.setFakeBoldText(false);prevX=x;prevY=py;previous=true;
        }
        canvas.restoreToCount(clip);paint.setTextSize(dp(10));paint.setColor(Color.rgb(148,163,184));
        SimpleDateFormat date=new SimpleDateFormat("m30".equals(frame)?"dd.MM HH:mm":"dd.MM.yy",Locale.GERMANY);
        canvas.drawText(date.format(new Date(first)),left,bottom+dp(20),paint);String endLabel=date.format(new Date(last));
        canvas.drawText(endLabel,right-paint.measureText(endLabel),bottom+dp(20),paint);
    }
    private void line(Canvas c,double value,String label,int color,double min,double max,float left,float right,float top,float bottom) {
        if(!ChartData.positive(value)||value<min||value>max) return;
        float py=y(value,min,max,top,bottom);paint.setColor(color);paint.setStrokeWidth(dp(1));paint.setTextSize(dp(10));
        c.drawLine(left,py,right,py,paint);c.drawText(label,left+dp(4),Math.max(top+dp(12),py-dp(4)),paint);
    }
    private float y(double value,double min,double max,float top,float bottom) {return top+(float)((max-value)/(max-min))*(bottom-top);}
    private float dp(float value) {return value*getResources().getDisplayMetrics().density;}
}
