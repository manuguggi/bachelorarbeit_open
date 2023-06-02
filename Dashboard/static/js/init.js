import DataHandler from './handler/DataHandler.js'
import GUImenuHandler from './handler/GUImenuHandler.js'
import GUIhomeHandler from './handler/GUIhomeHandler.js'
import GUIroutenHandler from './handler/GUIroutenHandler.js'

const dh = new DataHandler();
new GUImenuHandler(dh);
new GUIhomeHandler(dh);
new GUIroutenHandler(dh);
