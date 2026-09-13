module Main exposing (main)

import Browser
import Html exposing (Html, button, div, h1, text)
import Html.Events exposing (onClick)
import Maybe.Extra


main : Program () (Maybe Int) Msg
main =
    Browser.sandbox { init = Just 0, update = update, view = view }


type Msg
    = Increment
    | Decrement
    | Clear


update : Msg -> Maybe Int -> Maybe Int
update msg model =
    case msg of
        Increment ->
            Maybe.map ((+) 1) model

        Decrement ->
            Maybe.map (\n -> n - 1) model

        Clear ->
            Nothing


view : Maybe Int -> Html Msg
view model =
    div []
        [ h1 [] [ text "Packages work" ]
        , div [] [ text (Maybe.Extra.unwrap "no value" String.fromInt model) ]
        , button [ onClick Decrement ] [ text "-" ]
        , button [ onClick Increment ] [ text "+" ]
        , button [ onClick Clear ] [ text "clear" ]
        ]
