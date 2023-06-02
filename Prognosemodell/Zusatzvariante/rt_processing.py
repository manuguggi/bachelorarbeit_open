import pandas as pd
import numpy as np
import math
import datetime as datetime
from dateutil.relativedelta import relativedelta
import matplotlib.pyplot as plt
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
from sklearn.tree import DecisionTreeRegressor
from sklearn.ensemble import RandomForestRegressor
import inspect
from sklearn import tree
from statsmodels.tsa.arima.model import ARIMA
import pmdarima as pm

def train_val_test_auswahl(dataframe, start_date, end_date, month_gap):
    # Die Funktion benötigt ein Start- und Enddatum, jeweils auf die Trainingsdaten bezogen.
    # Zudem kann ein 'month_gap' eigegeben werden. Dadurch wären die Validierungs- und Testdaten 
    # um den gewünschten Zeitraum später als einfach der nächste Monat nach Enddatum der Trainingsdaten.
    
    s = pd.DataFrame(range(1), columns=['value'])
    s['start_date_train'] = pd.date_range(start=start_date, end=start_date)
    s['end_date_train'] = pd.date_range(start=end_date, end=end_date)
    s['start_date_val'] = s['end_date_train'].loc[0] + datetime.timedelta(days=1) + relativedelta(months=+month_gap)
    s['end_date_val'] = s['start_date_val'].loc[0] + relativedelta(months=+1) - datetime.timedelta(days=1)
    s['start_date_test'] = s['end_date_val'].loc[0] + datetime.timedelta(days=1)
    s['end_date_test'] = s['start_date_test'].loc[0] + relativedelta(months=+1) - datetime.timedelta(days=1)
    
    train = dataframe.loc[pd.Timestamp(s['start_date_train'].loc[0]):pd.Timestamp(s['end_date_train'].loc[0])]
    val = dataframe.loc[pd.Timestamp(s['start_date_val'].loc[0]):pd.Timestamp(s['end_date_val'].loc[0])]
    test = dataframe.loc[pd.Timestamp(s['start_date_test'].loc[0]):pd.Timestamp(s['end_date_test'].loc[0])]
    
    train = train.reset_index().set_index('Datum').asfreq('D')
    val = val.reset_index().set_index('Datum').asfreq('D')
    test = test.reset_index().set_index('Datum').asfreq('D')
    
    print("start_date_val: ", s['start_date_val'].loc[0], "⎮ end_date_val: ", s['end_date_val'].loc[0])
    print("start_date_test:", s['start_date_test'].loc[0], "⎮ end_date_test:", s['end_date_test'].loc[0], "\n")

    return train, val, test




# Funktion, die den Namen eines DF als String zurück gibt.
def get_df_name(df):
    name =[x for x in globals() if globals()[x] is df][0]
    return name

# Funktion, die bei der Übergabe von den richtigen und den vorausgesagten Werten, den MAPE returnt.
def mape(actual, pred): 
    actual, pred = np.array(actual), np.array(pred)
    return np.mean(np.abs((actual - pred) / actual)) * 100

# Funktion, die die Prdeictions und Residuen für ein Modell auf einem Dataset zurückgeben kann.
def get_prediction_and_residuum(fitted_model, data_set, soll_wert):
    prediction = fitted_model.predict( data_set )
    df_prediction = pd.DataFrame(prediction, columns = ['Prediction'])
    df_prediction['Residuum'] = soll_wert - df_prediction['Prediction']
    return df_prediction

# Funktion, die alle 4, von uns für die Regression verwendeten, Qualitätsmasse zurück gibt.
def get_r2_rmse_mae_mape(y_true, y_pred):    
    R2 = r2_score(y_true, y_pred)
    RMSE = math.sqrt(mean_squared_error(y_true, y_pred))
    MAE = mean_absolute_error(y_true, y_pred)
    MAPE = mape(y_true, y_pred)
    return R2, RMSE, MAE, MAPE




def get_baseline_performance(train_set, val_set, test_set):
    
    # cnt Durchschnittswerte  für Train/Val/Test Daten
    train_set['mean_cnt'] = train_set['cnt'].mean()
    val_set['mean_cnt'] = val_set['cnt'].mean()
    test_set['mean_cnt'] = test_set['cnt'].mean()
    
    # Berechnung der Qualitätswerte
    R2_TR, RMSE_TR, MAE_TR, MAPE_TR = get_r2_rmse_mae_mape(train_set['cnt'].to_numpy(), train_set['mean_cnt'].to_numpy())
    R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL = get_r2_rmse_mae_mape(val_set['cnt'].to_numpy(), val_set['mean_cnt'].to_numpy())
    R2_TE, RMSE_TE, MAE_TE, MAPE_TE = get_r2_rmse_mae_mape(test_set['cnt'].to_numpy(), test_set['mean_cnt'].to_numpy())
    
    # Printen der Qualitätsmasse
    print("\n", 'Baseline_test', ":")
    print("Qualität auf Trainingsdaten: \n", "R-squared: ", R2_TR, "\n", "RMSE: ", RMSE_TR,
          "\n", "MAE: ", MAE_TR, "\n", "MAPE: ", MAPE_TR)
    print("Qualität auf Validierungsdaten: \n", "R-squared: ", R2_VAL, "\n", "RMSE: ", RMSE_VAL,
          "\n", "MAE: ", MAE_VAL, "\n", "MAPE: ", MAPE_VAL)
    
    # returnt 3 Listen für Qualitätsdataframes (Train, Val, Test)
    return ["Baseline", 'train_set', R2_TR, RMSE_TR, MAE_TR, MAPE_TR], ["Baseline", 'val_set', R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL], ["Baseline", 'test_set', R2_TE, RMSE_TE, MAE_TE, MAPE_TE]




def get_rt_cv(train_set, val_set):
    
    train_performance = np.array([])
    val_performance = np.array([])

    train_set = train_set.reset_index()
    val_set = val_set.reset_index()
    
    train_X = train_set[['year', 'month', 'weekday']].to_numpy()
    train_y = train_set[['cnt']].to_numpy()
    val_X = val_set[['year', 'month', 'weekday']].to_numpy()
    val_y = val_set[['cnt']].to_numpy()
    
    def get_rmse_r2(true_y, pred_y):
        rmse = np.sqrt(mean_squared_error(true_y, pred_y))
        r2 = r2_score(true_y, pred_y)
        return [rmse, r2]
    
    
    max_vals = 100 
    
    for min_samples in range(1, max_vals):
        my_reg_tree = DecisionTreeRegressor(criterion='squared_error', min_samples_leaf=min_samples)
        my_fitted_tree = my_reg_tree.fit(train_X, train_y)
        
        train_y_pred = my_fitted_tree.predict(train_X)
        train_performance = np.append(train_performance, get_rmse_r2(train_y, train_y_pred), axis=0)

        val_y_pred = my_fitted_tree.predict(val_X)
        val_performance = np.append(val_performance, get_rmse_r2(val_y, val_y_pred), axis=0)

        
    train_performance = train_performance.reshape(-1, 2)
    val_performance = val_performance.reshape(-1, 2)

    train_set_name = None
    for name, obj in inspect.currentframe().f_back.f_locals.items():
        if obj is train_set:
            train_set_name = name
            break
    print(train_set_name, ":")
    
    fig, ax = plt.subplots(1, 2, figsize=(15,5))
    
    ax[0].plot(range(1, max_vals), train_performance[:, 0], color='b',
               label='Trainingsdaten')
    ax[0].plot(range(1, max_vals), val_performance[:, 0], color='g',
               label='Validierungsdaten')
    ax[0].grid()
    ax[0].set_title("RMSE")
    ax[0].set_xlabel("min_samples_leaf")
    
    ax[1].plot(range(1, max_vals), train_performance[:, 1], color='b',
               label='Trainingsdaten')
    ax[1].plot(range(1, max_vals), val_performance[:, 1], color='g',
               label='Validierungsdaten')
    ax[1].grid()
    ax[1].set_title("R-Squared")
    ax[1].set_xlabel("min_samples_leaf")
    
    plt.legend()
    plt.show() 


def get_rt_performance(train_set, val_set, test_set, min_leaf):

    # Daten vorbereiten
    train_X = train_set[['year', 'month', 'weekday']].to_numpy()
    train_y = train_set[['cnt']].to_numpy()
    val_X = val_set[['year', 'month', 'weekday']].to_numpy()
    val_y = val_set[['cnt']].to_numpy()
    test_X = test_set[['year', 'month', 'weekday']].to_numpy()
    test_y = test_set[['cnt']].to_numpy()
    
    # Modell trainieren, usw.
    reg_tree = DecisionTreeRegressor(criterion='squared_error', min_samples_leaf=min_leaf)
    fitted_tree = reg_tree.fit(train_X, train_y)
    train_y_pred  = fitted_tree.predict(train_X)
    val_y_pred  = fitted_tree.predict(val_X)
    test_y_pred  = fitted_tree.predict(test_X)
        
    # R-squared, RMSE, MAE, MAPE erstellen
    R2_TR, RMSE_TR, MAE_TR, MAPE_TR = get_r2_rmse_mae_mape(train_set['cnt'].to_numpy(), train_y_pred)
    R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL = get_r2_rmse_mae_mape(val_set['cnt'].to_numpy(), val_y_pred)
    R2_TE, RMSE_TE, MAE_TE, MAPE_TE = get_r2_rmse_mae_mape(test_set['cnt'].to_numpy(), test_y_pred)

    # Printen der Qualitätsmasse
    print("\n", 'RT_test', ":")
    print("Qualität auf Trainingsdaten: \n", "R-squared: ", R2_TR, "\n", "RMSE: ", RMSE_TR,
          "\n", "MAE: ", MAE_TR, "\n", "MAPE: ", MAPE_TR)
    print("Qualität auf Validierungsdaten: \n", "R-squared: ", R2_VAL, "\n", "RMSE: ", RMSE_VAL,
          "\n", "MAE: ", MAE_VAL, "\n", "MAPE: ", MAPE_VAL)
    
    fig, axes = plt.subplots(nrows=1, ncols=1, figsize=(15,10))
    tree.plot_tree(fitted_tree,
                feature_names = ['year', 'month', 'weekday'], 
                max_depth=3,
                filled = True)

    
    # returnt 3 Listen für Qualitätsdataframes (Train, Val, Test)
    return ["Regression Tree", 'train_set', R2_TR, RMSE_TR, MAE_TR, MAPE_TR], ["Regression Tree", 'val_set', R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL], ["Regression Tree", 'test_set', R2_TE, RMSE_TE, MAE_TE, MAPE_TE]



def get_sarimax_performance(df_train,df_val,df_test,p,d,q,P,D,Q,s):

    arima_model = ARIMA(df_train, order=(p,d,q), seasonal_order=(P,D,Q,s))
    arima_model = arima_model.fit()
    print(arima_model.summary())

    train_y_pred = arima_model.predict(start=df_train.index[0], end=df_train.index[df_train.shape[0] -1])
    val_y_pred = arima_model.predict(start=df_val.index[0], end=df_val.index[df_val.shape[0] -1])
    test_y_pred = arima_model.predict(start=df_test.index[0], end=df_test.index[df_test.shape[0] -1])

    R2_TR, RMSE_TR, MAE_TR, MAPE_TR = get_r2_rmse_mae_mape(df_train.to_numpy(), train_y_pred)
    R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL = get_r2_rmse_mae_mape(df_val.to_numpy(), val_y_pred)
    R2_TE, RMSE_TE, MAE_TE, MAPE_TE = get_r2_rmse_mae_mape(df_test.to_numpy(), test_y_pred)

    print("\n", 'RT_test', ":")
    print("Qualität auf Trainingsdaten: \n", "R-squared: ", R2_TR, "\n", "RMSE: ", RMSE_TR,
          "\n", "MAE: ", MAE_TR, "\n", "MAPE: ", MAPE_TR)
    print("Qualität auf Validierungsdaten: \n", "R-squared: ", R2_VAL, "\n", "RMSE: ", RMSE_VAL,
        "\n", "MAE: ", MAE_VAL, "\n", "MAPE: ", MAPE_VAL)

    return ["auto_ar-ARIMA", 'train_set', R2_TR, RMSE_TR, MAE_TR, MAPE_TR], ["auto_ar-ARIMA", 'val_set', R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL], ["auto_ar-ARIMA", 'test_set', R2_TE, RMSE_TE, MAE_TE, MAPE_TE]



def get_auto_arima_performance(df_train,df_val,df_test):
    arima = pm.auto_arima(df_train, error_action='ignore', trace=False, suppress_warnings=True, maxiter=365, seasonal=True, m=7, max_p=52, max_q=52)
    p = arima.order[0]
    d = arima.order[1]
    q = arima.order[2]
    P = arima.seasonal_order[0]
    D = arima.seasonal_order[1]
    Q = arima.seasonal_order[2]
    s = arima.seasonal_order[3]

    arima_model = ARIMA(df_train, order=(p,d,q), seasonal_order=(P,D,Q,s))
    arima_model = arima_model.fit()
    print(arima_model.summary())

    train_y_pred = arima_model.predict(start=df_train.index[0], end=df_train.index[df_train.shape[0] -1])
    val_y_pred = arima_model.predict(start=df_val.index[0], end=df_val.index[df_val.shape[0] -1])
    test_y_pred = arima_model.predict(start=df_test.index[0], end=df_test.index[df_test.shape[0] -1])

    R2_TR, RMSE_TR, MAE_TR, MAPE_TR = get_r2_rmse_mae_mape(df_train.to_numpy(), train_y_pred)
    R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL = get_r2_rmse_mae_mape(df_val.to_numpy(), val_y_pred)
    R2_TE, RMSE_TE, MAE_TE, MAPE_TE = get_r2_rmse_mae_mape(df_test.to_numpy(), test_y_pred)

    print("\n", 'RT_test', ":")
    print("Qualität auf Trainingsdaten: \n", "R-squared: ", R2_TR, "\n", "RMSE: ", RMSE_TR,
          "\n", "MAE: ", MAE_TR, "\n", "MAPE: ", MAPE_TR)
    print("Qualität auf Validierungsdaten: \n", "R-squared: ", R2_VAL, "\n", "RMSE: ", RMSE_VAL,
        "\n", "MAE: ", MAE_VAL, "\n", "MAPE: ", MAPE_VAL)

    return ["auto-ARIMA", 'train_set', R2_TR, RMSE_TR, MAE_TR, MAPE_TR], ["auto-ARIMA", 'val_set', R2_VAL, RMSE_VAL, MAE_VAL, MAPE_VAL], ["auto-ARIMA", 'test_set', R2_TE, RMSE_TE, MAE_TE, MAPE_TE]
