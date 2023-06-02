import os
import glob
import re
import pandas as pd

# Helper-Functions:

def read_overview():
    overview = pd.read_csv('data/overview.csv', sep=';')
    # Gaps zurück zu Datetime-Series:
    for i,r in overview.iterrows():
        timestamps = r['gaps'].strip('[]').split(', ')
        if timestamps == ['']: # Wenn keine Gaps vorhanden
            r['gaps'] = pd.Series(dtype='datetime64[ns]')
        else: # Wenn Gaps vorhanden
            r['gaps'] = pd.Series(pd.to_datetime(timestamps, format="Timestamp('%Y-%m-%d %H:%M:%S')"))
    return overview

def get_upload_filename_region_dates():
    filename = [os.path.basename(x) for x in glob.glob('data/uploads/*.csv')][0]
    dates = []
    dt = re.findall('[0-9]*-[0-9]*-[0-9]*', filename)
    dates.append(dt)
    region = re.search('Belp|Emmental|Gotthard|Herzogenbuchsee', filename)[0]
    return filename, region, dates

def get_txt_summary(dates_series):
    if dates_series.empty:
        return "-"
    s = dates_series
    date_ranges = s.groupby((s.dt.date - s.dt.date.shift(1)).fillna(pd.Timedelta(days=1)).ne(pd.Timedelta(days=1)).cumsum()).agg(['first', 'last'])
    single_date_groups = date_ranges[(date_ranges['last'] - date_ranges['first']).dt.days == 0]
    if not single_date_groups.empty:
        date_ranges = date_ranges[~date_ranges.index.isin(single_date_groups.index)]
        single_dates_summary = ", ".join(single_date_groups['first'].dt.strftime('%d.%m.%Y'))
        if date_ranges.empty:
            return single_dates_summary
        else:
            return ", ".join(date_ranges.apply(lambda x: f"{x['first'].strftime('%d.%m.%Y')} - {x['last'].strftime('%d.%m.%Y')}", axis=1)) + ", " + single_dates_summary
    else:
        return ", ".join(date_ranges.apply(lambda x: f"{x['first'].strftime('%d.%m.%Y')} - {x['last'].strftime('%d.%m.%Y')}", axis=1))
    
def get_existing_dates(region):
    overview = read_overview()
    first_date = overview[overview['region'] == region].iloc[0]['first_date']
    last_date = overview[overview['region'] == region].iloc[0]['last_date']
    existing_dates = pd.Series(pd.date_range(start=first_date, end=last_date))
    gaps = pd.Series(overview[overview['region'] == region].iloc[0]['gaps'])
    existing_dates = existing_dates[~existing_dates.isin(gaps)] # existing_dates minus gaps
    return existing_dates



# Managing-Functions:

def get_uploadFile_info():
    # Region, Erstes- & Letztes Datum erkennen
    filename, region, dates = get_upload_filename_region_dates()
    first_date = pd.to_datetime(dates[0][0]).strftime('%d.%m.%Y')
    last_date = pd.to_datetime(dates[0][1]).strftime('%d.%m.%Y')

    # Overrides erkennen
    upload_dates = pd.Series(pd.date_range(start=dates[0][0], end=dates[0][1]))
    existing_dates = get_existing_dates(region)
    override = upload_dates[upload_dates.isin(existing_dates)]
    override_txt = get_txt_summary(override)

    return [region, first_date, last_date, override_txt]


def get_new_liveData(filename, region):
    live_df = pd.read_csv('data/'+region+'.csv', sep=';')
    # Upload-DF einlesen + Zusatzcheck (Manchmal haben die Dateien Doublequotes & jede Zeile in Quotes)
    with open('data/uploads/'+filename, 'r') as f:
        data = f.read()
    if data.startswith('"_id,""'):
        data = data[1:-2]
        data = data.replace('"\n"', '\n')
        data = data.replace('""', '"')
        with open('data/uploads/'+filename, 'w') as f:
            f.write(data)
    upload_df = pd.read_csv('data/uploads/'+filename, quotechar='"')
    # Live-DF updaten & überschreiben:
    updated_live_df = live_df[~live_df['_id'].isin(upload_df['_id'])] # Zu überschreibende Einträge entfernen
    updated_live_df = updated_live_df.append(upload_df)
    return updated_live_df


def update_overview():
    overview = read_overview()
    filename, region, dates = get_upload_filename_region_dates()
    upload_dates = pd.Series(pd.date_range(start=dates[0][0], end=dates[0][1]))
    existing_dates = get_existing_dates(region)
    new_dates = upload_dates[~upload_dates.isin(existing_dates)] # upload dates without overriden dates
    new_existing_dates = pd.concat([existing_dates, new_dates]).reset_index(drop=True) # Alle verfügbaren Daten (Neu)
    # Neues first- & last_date
    new_first_date = pd.to_datetime(new_existing_dates.min()).strftime('%Y-%m-%d')
    new_last_date = pd.to_datetime(new_existing_dates.max()).strftime('%Y-%m-%d')
    overview.loc[overview[overview['region'] == region].index[0]]['first_date'] = new_first_date
    overview.loc[overview[overview['region'] == region].index[0]]['last_date'] = new_last_date
    # Neue Gaps
    full_period = pd.Series(pd.date_range(start=new_first_date, end=new_last_date))
    new_gaps = full_period[~full_period.isin(new_existing_dates)] #full_period(new_first_date bis new_last_date) - new_existing_dates
    new_gaps = new_gaps.reset_index(drop=True)
    new_gaps_txt = get_txt_summary(new_gaps)
    overview.loc[overview[overview['region'] == region].index[0]]['gaps'] = new_gaps 
    overview.loc[overview[overview['region'] == region].index[0]]['gaps_txt'] = new_gaps_txt
    # Overview-Datei überschreiben
    overview.gaps = [x.to_list() if not x.empty else [] for x in overview.gaps] # Wenn keine gaps: []
    overview.to_csv('data/overview.csv', index=False, sep=';')

