import flask
import flask_login
import bcrypt
import shutil
import time
from random import randrange
import sys
import json
import os
import glob

sys.path.append('static/py')
import file_manager
sys.path.remove('static/py')


#############
### Setup ###
#############

app = flask.Flask(__name__, template_folder='static')
app.config['ENV'] = 'production'


###################
### Login-Logik ###
###################

users = {'email@email.ch': {'password': b'12345'}} # hashed pw

app.secret_key = 'key' # replace key
login_manager = flask_login.LoginManager()
login_manager.init_app(app)

class User(flask_login.UserMixin):
    pass

@login_manager.user_loader
def user_loader(email):
    if email not in users:
        return

    user = User()
    user.id = email
    return user

@login_manager.request_loader
def request_loader(request):
    email = request.form.get('email')
    if email not in users:
        return

    user = User()
    user.id = email
    return user

@app.route('/login', methods=['GET', 'POST'])
def login():
    if flask.request.method == 'GET': # Wenn Seite nur angefragt wird (ohne POST mit PW & Email)
        return flask.render_template('sign-in.html', randomno = randrange(100000))

    email = flask.request.form['email']
    if email in users and bcrypt.checkpw(flask.request.form['password'].encode("utf-8"), users[email]['password']): # Wenn Email existiert und PW korrekt
        user = User()
        user.id = email
        flask_login.login_user(user)
        return flask.redirect('/')

    if email not in users: # Wenn kein User gefunden wurde
        return flask.render_template('sign-in.html', user_error=email)
    elif not bcrypt.checkpw(flask.request.form['password'].encode("utf-8"), users[email]['password']): # Wenn Passwort nich korrekt
        return flask.render_template('sign-in.html', pw_error=email)

    return 'Bad login'


@login_manager.unauthorized_handler 
def unauthorized_handler(): # Wenn nicht authorisiert --> Auf Login-Page weiterleiten
    return flask.redirect(flask.url_for('login'))


#################
### Endpoints ###
#################

@app.route('/')
@flask_login.login_required
def home():
    return flask.render_template('index.html', randomno = randrange(100000))

# Dateien in /data/ für d3.csv() zugänglich machen
@app.route('/data/<path:path>')
@flask_login.login_required
def serve_static(path):
    return flask.send_from_directory('data/', path)


@app.route('/check_file', methods=['POST'])
@flask_login.login_required
def check_file():
    # 2-Fach Upload vermeiden (bestehende Files löschen)
    for file in [os.path.basename(x) for x in glob.glob('data/uploads/*.csv')]:
        os.remove('data/uploads/' + file)
    # Neues File speichern
    file = flask.request.files['file']
    file.save('data/uploads/' + file.filename)
    # Info zu neuem File generieren
    info = file_manager.get_uploadFile_info()
    response = json.dumps({'info': info})
    return response


@app.route('/confirm_file', methods=['GET'])
@flask_login.login_required
def confirm_file():
    filename, region, dates = file_manager.get_upload_filename_region_dates()
    updated_live_df = file_manager.get_new_liveData(
        filename, region)  # Neuen Live-Datensatz generieren
    file_manager.update_overview()  # Overview-File updaten
    # Zeitstempel für neuen Ordnernamen im Archiv
    timestamp = str(int(time.time()))
    os.mkdir('data/uploads/archive/' + timestamp)
    # Upload-File ins Archiv bewegen
    for file in [os.path.basename(x) for x in glob.glob('data/uploads/*.csv')]:
        os.rename('data/uploads/' + file,
                  'data/uploads/archive/' + timestamp + '/' + file)
    # Alte Livedaten ins Archiv kopieren
    for file in [os.path.basename(x) for x in glob.glob('data/' + region + '.csv')]:
        shutil.copy('data/' + file, 'data/uploads/archive/' +
                    timestamp + '/' + file)
    updated_live_df.to_csv('data/'+region+'.csv', sep=';',
                           index=False)  # Livedaten überschreiben
    return 'Upload successful'


###################
### App Starten ###
###################

if __name__ == '__main__':
    app.run(debug=True, port=5000)
