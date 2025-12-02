import numpy as np
import pandas as pd
import yfinance as yf
from sklearn.preprocessing import StandardScaler
from typing import Dict, List
import datetime as _dt
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers


def _download_close(ticker: str, start_date: str) -> pd.Series:
    d = yf.download(
        ticker,
        start=start_date,
        progress=False,
        auto_adjust=False,
        actions=False,
        threads=False,
    )
    if d.empty:
        return pd.Series(dtype=float)
    s = d["Close"] if "Close" in d else d.get("Adj Close", pd.Series(dtype=float))
    s = s.copy()
    s.index = pd.to_datetime(s.index)
    if s.index.tz is not None:
        s.index = s.index.tz_localize(None)
    s = s.sort_index()
    idx_b = pd.date_range(s.index.min(), s.index.max(), freq="B")
    s = s.reindex(idx_b).ffill()
    return s.dropna()


def _rsi(series: pd.Series, n: int = 14) -> pd.Series:
    delta = series.diff()
    up = delta.clip(lower=0).rolling(n).mean()
    down = (-delta.clip(upper=0)).rolling(n).mean()
    rs = up / (down.replace(0, np.nan))
    return 100 - (100 / (1 + rs))


def _build_dataset(ticker: str, start_date: str) -> pd.DataFrame:
    exog_map = {
        "USDRUB=X": ["EURRUB=X", "BZ=F", "GC=F"],
        "AAPL": ["SPY", "GC=F"],
    }
    exog = exog_map.get(ticker, [])

    tickers = [ticker] + exog
    data = {}
    for t in tickers:
        s = _download_close(t, start_date)
        if s.empty:
            continue
        data[t] = s
    if ticker not in data:
        raise ValueError(f"No data for ticker {ticker}")

    df = pd.concat(data, axis=1).dropna()
    df.columns = list(data.keys())

    
    df["ret_target"] = np.log(df[ticker] / df[ticker].shift(1))

    
    for t in exog:
        if t in df.columns:
            df[f"ret_{t}"] = np.log(df[t] / df[t].shift(1))

    # Tech indicators of target
    ret_full = np.log(df[ticker] / df[ticker].shift(1))
    df["vol20"] = ret_full.rolling(20).std()
    df["ma5"] = df[ticker].rolling(5).mean()
    df["ma20"] = df[ticker].rolling(20).mean()
    df["ma60"] = df[ticker].rolling(60).mean()
    df["rsi14"] = _rsi(df[ticker], 14)
    roll_max60 = df[ticker].rolling(60).max()
    df["dd60"] = df[ticker] / roll_max60 - 1.0

    for lag in [1, 2, 3, 5]:
        df[f"ret_target_lag{lag}"] = df["ret_target"].shift(lag)

    df = df.dropna()
    return df


def _make_future_bdays(last_date: pd.Timestamp, horizon: int) -> List[pd.Timestamp]:
    start = (last_date + pd.tseries.offsets.BDay(1)).date()
    rng = pd.bdate_range(start=start, periods=horizon)
    return list(rng)


def forecast_ticker(
    ticker: str,
    horizon_days: int,
    start_date: str = "2015-01-01",
) -> Dict:
    
    horizon_days = int(horizon_days)
    horizon_days = max(3, min(30, horizon_days))

    df = _build_dataset(ticker, start_date)

    
    today = pd.Timestamp(_dt.date.today())
    df = df.loc[df.index <= today]
    if df.empty or df.shape[0] < 120:
        raise ValueError("Not enough data after cleaning")

    base_exog = [c for c in df.columns if c.startswith("ret_") and c != "ret_target"]
    feature_cols = base_exog + [
        "vol20",
        "ma5",
        "ma20",
        "ma60",
        "rsi14",
        "dd60",
        "ret_target_lag1",
        "ret_target_lag2",
        "ret_target_lag3",
        "ret_target_lag5",
    ]
    X_raw = df[feature_cols].values
    y_raw = df["ret_target"].values.reshape(-1, 1)

    scaler_X = StandardScaler()
    scaler_y = StandardScaler()
    X_scaled = scaler_X.fit_transform(X_raw)
    y_scaled = scaler_y.fit_transform(y_raw)

    window = 30
    X_seq, y_seq = [], []
    for i in range(window, len(X_scaled)):
        X_seq.append(X_scaled[i - window : i, :])
        y_seq.append(y_scaled[i, 0])
    X_seq = np.array(X_seq)
    y_seq = np.array(y_seq).reshape(-1, 1)
    if X_seq.shape[0] < 10:
        raise ValueError("Not enough sequence samples to train")

    tf.random.set_seed(123)
    model = keras.Sequential([
        layers.Input(shape=(X_seq.shape[1], X_seq.shape[2])),
        layers.LSTM(64, return_sequences=False),
        layers.Dense(32, activation="relu"),
        layers.Dense(1, activation="linear"),
    ])
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=5e-4), loss="mse")
    model.fit(X_seq, y_seq, epochs=20, batch_size=64, validation_split=0.2, verbose=0)

    hist_prices = df[ticker].copy()
    last_date = hist_prices.index[-1]
    history_window_days = min(60, len(hist_prices))
    history_dates = [pd.Timestamp(d).date().isoformat() for d in hist_prices.index[-history_window_days:]]
    history_vals = [float(v) for v in hist_prices.values[-history_window_days:]]

    future_dates = _make_future_bdays(last_date, horizon_days)
    price_list = list(hist_prices.values)
    ret_list = list(df["ret_target"].values)

    last_window_scaled = X_scaled[-window:, :]

    for _ in range(horizon_days):
        pred_scaled = model.predict(last_window_scaled[np.newaxis, ...], verbose=0)[0, 0]
        ret_pred = float(scaler_y.inverse_transform(np.array([[pred_scaled]]))[0, 0])

        next_price = price_list[-1] * float(np.exp(ret_pred))
        price_list.append(next_price)
        ret_list.append(ret_pred)

        p_series = pd.Series(price_list)
        r_series = pd.Series(ret_list)
        vol20 = float(r_series[-20:].std()) if len(r_series) >= 20 else 0.0
        ma5 = float(p_series[-5:].mean()) if len(p_series) >= 5 else 0.0
        ma20 = float(p_series[-20:].mean()) if len(p_series) >= 20 else 0.0
        ma60 = float(p_series[-60:].mean()) if len(p_series) >= 60 else 0.0
        rsi14_series = _rsi(p_series, 14)
        rsi14 = float(rsi14_series.iloc[-1]) if not rsi14_series.empty else 0.0
        roll_max60 = float(p_series[-60:].max()) if len(p_series) >= 60 else 0.0
        dd60 = (next_price / roll_max60 - 1.0) if roll_max60 not in (0.0, np.nan) else 0.0

        ret_lag1 = ret_list[-1]
        ret_lag2 = ret_list[-2] if len(ret_list) >= 2 else 0.0
        ret_lag3 = ret_list[-3] if len(ret_list) >= 3 else 0.0
        ret_lag5 = ret_list[-5] if len(ret_list) >= 5 else 0.0

        feat_map = {c: 0.0 for c in feature_cols} 
        for c in feature_cols:
            if c == "vol20": feat_map[c] = vol20
            elif c == "ma5": feat_map[c] = ma5
            elif c == "ma20": feat_map[c] = ma20
            elif c == "ma60": feat_map[c] = ma60
            elif c == "rsi14": feat_map[c] = rsi14
            elif c == "dd60": feat_map[c] = dd60
            elif c == "ret_target_lag1": feat_map[c] = ret_lag1
            elif c == "ret_target_lag2": feat_map[c] = ret_lag2
            elif c == "ret_target_lag3": feat_map[c] = ret_lag3
            elif c == "ret_target_lag5": feat_map[c] = ret_lag5

        x_next = np.array([[feat_map[c] for c in feature_cols]], dtype=float)
        x_next_scaled = scaler_X.transform(x_next)
        last_window_scaled = np.vstack([last_window_scaled[1:], x_next_scaled])

    forecast_prices = price_list[-horizon_days:]
    forecast_dates_iso = [d.date().isoformat() for d in future_dates]

    return {
        "ticker": ticker,
        "history": {"dates": history_dates, "prices": history_vals},
        "forecast": {"dates": forecast_dates_iso, "prices": [float(x) for x in forecast_prices]},
    }
