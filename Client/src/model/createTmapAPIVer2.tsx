// 리액트 라이브러리
import React, { useState, useEffect, useRef, useContext } from "react";

// 외부 라이브러리
import { Box } from "@chakra-ui/react";

// 리액트 컴포넌트
import TrafficPointData from "./getTrafficPointData";
import getCurrentPosition from "./getCurrentPosition";
import { AuthContext } from "./trafficCongestionContext";
import VideoPlayer from "../view/pages/youtubePlayer/youtubePlayerVer2";
import Header from "../view/components/header";

declare global {
  interface Window {
    Tmapv3: any;
  }
}

const MapContainer: React.FC = () => {
  
    const [userCurrentLocation, setUserCurrentLocation] =
    useState<GeolocationCoordinates | null>(null);
  const [userRealTimeLocation, setUserRealTimeLocation] =
    useState<GeolocationCoordinates | null>(null);
  const [map, setMap] = useState<any>(null);
  const [polyLineArr, setPolyLineArr] = useState<any[]>([]);
  const [marker, setMarker] = useState<any>(null);
  const [isMapReady, setMapReady] = useState(true);
  const markerRef = useRef<any>(null);
  const { congestion, setCongestion } = useContext(AuthContext);
  const { color, setColor } = useContext(AuthContext);
  const {handleCongestion} = useContext(AuthContext)

  // * currentPosition으로 1차적으로 위치 정보 수집
  useEffect(() => {
    getCurrentPosition().then(data=>{
      setUserCurrentLocation(data)
    })
  }, []);

  // * currentPosition으로 가져온 정보를 토대로 tMap 지도 생성
  useEffect(() => {
    if (userCurrentLocation) {
      const checkTmapv3Loaded = () => {
        if (window.Tmapv3) {
          return true;
        } else {
          setTimeout(checkTmapv3Loaded, 50);
        }
      };

      const generateMap = () => {
        // console.log("2. 최초 위치를 토대로 맵 생성");
        const map = new window.Tmapv3.Map("tMapContainer", {
          width: "100%",
          height: "70%",
          zoom: 15,
        });
        return { map };
      };

      
      const isTmapv3Loaded = checkTmapv3Loaded();
      if (isTmapv3Loaded) {
        //* generateMap 함수는 현재 위치의 지도 정보를 반환함
        const { map } = generateMap();
        setMap(map);
        setMapReady(false);
      }
    }
  }, [userCurrentLocation]);

  // * 지도가 생성되었을 경우 currentPosition 정보를 토대로 마커 생성
  useEffect(() => {
    if (map && userCurrentLocation) {
      // console.log("3. 사용자 위치를 토대로 마커 생성");
      const centerLatLng = new window.Tmapv3.LatLng(
        userCurrentLocation.latitude,
        userCurrentLocation.longitude
      );
      map.setCenter(centerLatLng);

      if (marker) {
        marker.setPosition(centerLatLng);
      }
    }
  }, [map, userCurrentLocation]);

  // * 지도와 마커가 생성되었을 경우 watchPosition 메서드를 실행
  useEffect(() => {
    if (userCurrentLocation && map) {
      const checkLatLngLoaded = () => {
        if (window.Tmapv3 && window.Tmapv3.LatLng) {
          return true;
        } else {
          setTimeout(checkLatLngLoaded, 100);
        }
      };

      const isLatLngLoaded = checkLatLngLoaded();
      //* 마커와 지도가 생성 되었을 경우
      if (isLatLngLoaded) {
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            setUserRealTimeLocation(position.coords);
            console.log(
              "4. watchPosition으로 실시간 위치 정보를 수집",
              position.coords.latitude,
              position.coords.longitude
            );
          },
          (error) => {
            console.log(error);
          },
          {
            enableHighAccuracy: false,
            maximumAge: 10000,
          }
        );
          //* 현재 위치 감지 중지
        return () => {
          navigator.geolocation.clearWatch(watchId);
        };
      }
    } else {
      console.log("사용자 환경이 위치 정보를 제공하지 않습니다.");
    }
  }, [userCurrentLocation,map]);

  // * watchPosition으로 가져온 위치 정보를 토대로 marker 포지션 재설정
  useEffect(() => {
    // console.log("5. 실시간 위치 정보를 토대로 마커 갱신");
    if (userRealTimeLocation) {
      const centerLatLng = new window.Tmapv3.LatLng(
        userRealTimeLocation?.latitude,
        userRealTimeLocation?.longitude
      );
      map.setCenter(centerLatLng);

      if (markerRef.current) {
        // 기존 마커 객체 제거
        markerRef.current.setMap(null);
      }

      // 새로운 마커 객체 생성 및 설정
      const newMarker = new window.Tmapv3.Marker({
        position: centerLatLng,
        map: map,
      });

      markerRef.current = newMarker;
    }
  }, [userRealTimeLocation]);

  // ? 사용자 위치 교통 정보를 요청하는 함수
  const getPointTrafficData = () => {
    const requestURI = `https://apis.openapi.sk.com/tmap/traffic?version=${TrafficPointData.version}&format=json&reqCoordType=${TrafficPointData.reqCoordType}&resCoordType=${TrafficPointData.resCoordType}&centerLat=${userRealTimeLocation?.latitude}&centerLon=${userRealTimeLocation?.longitude}&trafficType=${TrafficPointData.trafficType1}&zoomLevel=${TrafficPointData.zoomLevel}&callback=${TrafficPointData.callback}&appKey=${TrafficPointData.appKey}`;
    const aroundRequestURI = `https://apis.openapi.sk.com/tmap/traffic?version=${TrafficPointData.version}&format=json&reqCoordType=${TrafficPointData.reqCoordType}&resCoordType=${TrafficPointData.resCoordType}&centerLat=${userRealTimeLocation?.latitude}&centerLon=${userRealTimeLocation?.longitude}&trafficType=${TrafficPointData.trafficType2}&zoomLevel=${TrafficPointData.zoomLevel}&callback=${TrafficPointData.callback}&radius=${TrafficPointData.radius}&appKey=${TrafficPointData.appKey}`;
    fetch(requestURI)
      .then((response) => {
        if (!response.ok) {
          throw new Error("요청이 실패하였습니다.");
        }
        return response.json();
      })
      .then((data) => {
        console.log("요청이 성공하였습니다.");
        const resultData = data.features;
        // console.log('resultdata= ',resultData) 
        //resultdata.properties.congestion:"3"
        
        const congestionValues = resultData.map(
          (item: any) => item.properties.congestion
        );
        // 혼잡도 정보를 useContext로 관리
        setCongestion(congestionValues[0]);
        setColor(congestionValues[0]);
        //! 사용자 위치의 도로 교통 정보(혼잡도)를 나타내는 부분
      })
      .catch((error) => {
        console.log(error);
      });

      fetch(aroundRequestURI)
      .then((response) => {
        if (!response.ok) {
          throw new Error("AROUND 요청이 실패하였습니다.");
        }
        return response.json();
      })
      .then((data) => {
        console.log("AROUND 요청이 성공하였습니다.");
        const resultData = data.features;
        const congestionValues = resultData.map(
          (item: any) => item.properties.congestion
        );
        //! 사용자 위치의 도로 교통 정보(혼잡도)를 나타내는 부분
        // console.log("AROUND 혼잡도:" + congestionValues); // ['2'], length: 1, Prototype: Array(0)


        if (polyLineArr.length > 0) {
          console.log("폴리라인"+polyLineArr);
          polyLineArr.forEach((polyline) => {
            polyline.setMap(null);
          });
          //? API 공식 문서에서는 removeAllFeatures(); 을 사용 했지만, polyLineArr 엔 removeAllFeatures() 속성 없음.
        }
        setTimeout(() => {
          const newPolyLineArr: any[] = [];
      
          for (const i in resultData) {
            const geometry = resultData[i].geometry;
            const properties = resultData[i].properties;
      
            if (geometry.type === "LineString") {
              const drawInfoArr: any[] = [];
      
              for (const j in geometry.coordinates) {
                const latlng = new window.Tmapv3.Point(
                  geometry.coordinates[j][0],
                  geometry.coordinates[j][1]
                );
                const convertPoint = new window.Tmapv3.Projection.convertEPSG3857ToWGS84GEO(
                  latlng
                );
                const convertChange = new window.Tmapv3.LatLng(
                  convertPoint._lat,
                  convertPoint._lng
                );
                drawInfoArr.push(convertChange);
              }
      
              let lineColor = "";
              const sectionCongestion = properties.congestion;
              if (sectionCongestion === 0) {
                lineColor = "#06050D";
              } else if (sectionCongestion === 1) {
                lineColor = "#61AB25";
              } else if (sectionCongestion === 2) {
                lineColor = "#FFFF00";
              } else if (sectionCongestion === 3) {
                lineColor = "#FF7200";
              } else if (sectionCongestion === 4) {
                lineColor = "#FF0000";
              }
              // ? 폴리라인 그리는 코드
              const polyline = new window.Tmapv3.Polyline({
                path: drawInfoArr,
                strokeColor: lineColor,
                strokeWeight: 6,
                map: map,
              });
              newPolyLineArr.push(polyline);
            }
          }
      
          setPolyLineArr(newPolyLineArr);
        }, 100);  
      })
      .catch((error) => {
        console.log(error);
      });
  };
  //*------------------------------------------------
  
  //*------------------------------------------------

  // ! 5초 뒤에 교통정보 요청 함수를 실행
  // useEffect(() => {

  //   const timeoutId = setTimeout(() => {
  //     getPointTrafficData(); // 사용자 위치 교통정보 요청 함수 실행
  //     // getAroundTrafficData(); // 사용자 주변 교통정보 요청 함수 실행
  //     const intervalPoint = setInterval(getPointTrafficData, 10000); // 10초마다 반복 실행
  //     // const intervalAround = setInterval(getAroundTrafficData, 10000); // 10초마다 반복 실행
  //     // 컴포넌트가 언마운트될 때 interval 제거
  //     return () => {
  //       clearInterval(intervalPoint);
  //       // clearInterval(intervalAround);
  //     };
  //   },5000);

  //   // 컴포넌트가 언마운트될 때 timeout 제거
  //   return () => {
  //     clearTimeout(timeoutId);
  //   };
  // }, []);
  // ! 노래 끝날 때 마다 교통정보 요청.
  useEffect(() => {
    getPointTrafficData();

  }, [handleCongestion]);

  return (
    <>
      <>
        {!isMapReady && <Header />}
        <Box id="tMapContainer" position={"sticky"}>
          {isMapReady && (
            <dotlottie-player
              src="https://lottie.host/21edb5c7-0e2f-41fe-bd21-12a0c246b066/0ajUoSiKvd.json"
              autoplay
              loop
              style={{ width: "100%", height: "100%" }}
            />
          )}
        </Box>
        {!isMapReady && (
          <Box
            className="navigationBar"
            display={"flex"}
            flexDirection={"column"}
            width={"100%"}
            height={"20%"}
            fontSize={"24px"}
            backgroundColor={"#21325E"}
            borderRadius={"10% 10% 0% 0%;"}
          >
            {/* 현재 혼잡도 : {congestion} */}
            <VideoPlayer />
            {/* <MusicController />
            <NavigationController /> */}
          </Box>
        )}
      </>
    </>
  );
};

export default MapContainer;
