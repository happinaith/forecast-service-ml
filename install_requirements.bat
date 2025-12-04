@echo off
echo Установка необходимых пакетов...

py -m pip install --upgrade pip

py -m pip install fastapi
py -m pip install uvicorn[standard]
py -m pip install pydantic
py -m pip install pandas
py -m pip install numpy
py -m pip install yfinance
py -m pip install scikit-learn
py -m pip install tensorflow
py -m pip install matplotlib

echo Установка завершена!
pause